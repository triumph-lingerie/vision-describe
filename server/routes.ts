import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertImageAnalysisSchema } from "@shared/schema";
import { analyzeImage, analyzeImages } from "./services/openai";
import multer from "multer";
import { z } from "zod";

// Configure multer for memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Upload and analyze images
  app.post("/api/images/analyze", upload.array('images', 10), async (req: Request, res: Response) => {
    try {
      const files = req.files as Express.Multer.File[];
      const { language = "uk", category = "product" } = req.body;
      
      if (!files || files.length === 0) {
        return res.status(400).json({ message: "No images uploaded" });
      }

      const results = [];

      if (files.length === 1) {
        // Single image analysis
        const file = files[0];
        try {
          const base64Image = file.buffer.toString('base64');
          const description = await analyzeImage(base64Image, file.mimetype, language, category);
          
          const analysis = await storage.createImageAnalysis({
            filename: `${Date.now()}-${file.originalname}`,
            originalName: file.originalname,
            mimeType: file.mimetype,
            fileSize: file.size,
            description: description,
            language: language,
            category: category,
          });

          results.push({
            id: analysis.id,
            originalName: analysis.originalName,
            description: analysis.description,
            createdAt: analysis.createdAt,
            fileSize: analysis.fileSize,
            language: analysis.language,
            category: analysis.category,
            imageData: `data:${file.mimetype};base64,${base64Image}`
          });
        } catch (error) {
          console.error(`Error processing file ${file.originalname}:`, error);
          results.push({
            originalName: file.originalname,
            error: error instanceof Error ? error.message : "Failed to process image"
          });
        }
      } else {
        // Multiple images analysis - analyze together for better description
        const combinedOriginalName = `${files.map(f => f.originalname).join(', ')}`;
        try {
          const images = files.map(file => ({
            base64: file.buffer.toString('base64'),
            mimeType: file.mimetype
          }));
          
          const description = await analyzeImages(images, language, category);
          
          // Create a combined filename for storage
          const combinedFilename = `${Date.now()}-combined-${files.length}-images`;
          const totalFileSize = files.reduce((sum, file) => sum + file.size, 0);
          
          const analysis = await storage.createImageAnalysis({
            filename: combinedFilename,
            originalName: combinedOriginalName,
            mimeType: files[0].mimetype, // Use first file's mimetype
            fileSize: totalFileSize,
            description: description,
            language: language,
            category: category,
          });

          // Return all images with the combined description
          const allImagesData = files.map(file => `data:${file.mimetype};base64,${file.buffer.toString('base64')}`);
          
          results.push({
            id: analysis.id,
            originalName: analysis.originalName,
            description: analysis.description,
            createdAt: analysis.createdAt,
            fileSize: analysis.fileSize,
            language: analysis.language,
            category: analysis.category,
            imageData: allImagesData[0], // Primary image for display
            allImages: allImagesData, // All images for carousel
            isMultiImage: true,
            imageCount: files.length
          });
        } catch (error) {
          console.error(`Error processing multiple images:`, error);
          results.push({
            originalName: combinedOriginalName,
            error: error instanceof Error ? error.message : "Failed to process images"
          });
        }
      }

      res.json({ results });

    } catch (error) {
      console.error("Error in image analysis:", error);
      res.status(500).json({ 
        message: error instanceof Error ? error.message : "Internal server error" 
      });
    }
  });

  // Get all image analyses
  app.get("/api/images", async (req: Request, res: Response) => {
    try {
      const analyses = await storage.getImageAnalyses();
      res.json(analyses);
    } catch (error) {
      console.error("Error fetching image analyses:", error);
      res.status(500).json({ message: "Failed to fetch image analyses" });
    }
  });

  // Get specific image analysis
  app.get("/api/images/:id", async (req: Request, res: Response) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid image ID" });
      }

      const analysis = await storage.getImageAnalysis(id);
      if (!analysis) {
        return res.status(404).json({ message: "Image analysis not found" });
      }

      res.json(analysis);
    } catch (error) {
      console.error("Error fetching image analysis:", error);
      res.status(500).json({ message: "Failed to fetch image analysis" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
