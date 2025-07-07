import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, Plus, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageUploadProps {
  onUploadComplete: (results: any[]) => void;
  language?: string;
  category?: string;
}

export function ImageUpload({ onUploadComplete, language = "uk", category = "product" }: ImageUploadProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const { toast } = useToast();

  const uploadFiles = async (files: File[]) => {
    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('images', file);
      });
      
      // Add language and category to form data
      formData.append('language', language);
      formData.append('category', category);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch('/api/images/analyze', {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      // Check for any errors in individual results
      const errors = data.results.filter((result: any) => result.error);
      const successes = data.results.filter((result: any) => !result.error);

      if (errors.length > 0) {
        toast({
          title: "Some uploads failed",
          description: `${successes.length} processed successfully, ${errors.length} failed`,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Upload successful",
          description: `${successes.length} image(s) processed successfully`,
        });
      }

      onUploadComplete(data.results);

    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    // Check if category is specified
    if (!category || category.trim() === "") {
      toast({
        title: "Category required",
        description: "Please specify a product category before uploading images",
        variant: "destructive",
      });
      return;
    }

    const validFiles = acceptedFiles.filter(file => {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than 10MB`,
          variant: "destructive",
        });
        return false;
      }
      return true;
    });

    if (validFiles.length > 0) {
      uploadFiles(validFiles);
    }
  }, [toast, category]);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isDragReject
  } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.webp', '.gif']
    },
    multiple: true,
    maxFiles: 10,
    disabled: isUploading
  });

  return (
    <Card className="p-8">
      <div
        {...getRootProps()}
        className={cn(
          "border-2 border-dashed rounded-lg p-12 text-center transition-colors duration-150 cursor-pointer",
          isDragAccept && "border-primary bg-primary/5",
          isDragReject && "border-destructive bg-destructive/5",
          isDragActive && !isDragReject && "border-primary bg-primary/5",
          !isDragActive && "border-border hover:border-muted-foreground",
          isUploading && "cursor-not-allowed opacity-50",
          (!category || category.trim() === "") && "border-muted-foreground/50 opacity-75"
        )}
      >
        <input {...getInputProps()} />
        
        {isUploading ? (
          <div className="space-y-4">
            <div className="p-4 rounded-full bg-muted mx-auto w-fit">
              <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium text-foreground">
                Processing images...
              </p>
              <p className="text-sm text-muted-foreground">
                Generating product descriptions with GPT-4 Vision
              </p>
              <div className="max-w-xs mx-auto">
                <Progress value={uploadProgress} className="h-2" />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center space-y-4">
            <div className="p-4 rounded-full bg-muted">
              <Upload className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium text-foreground">
                {isDragActive
                  ? "Drop your product images here"
                  : "Drop your product images here or click to browse"
                }
              </p>
              <p className="text-sm text-muted-foreground">
                Upload product photos (PNG, JPG, JPEG, WEBP up to 10MB)
              </p>
              {(!category || category.trim() === "") && (
                <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                  ⚠️ Please specify a product category above before uploading
                </p>
              )}
            </div>
            {!isDragActive && (
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Select Product Images
              </Button>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
