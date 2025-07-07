import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Code, ExternalLink, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export default function ApiDocumentation() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <Link href="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Back to Generator
        </Link>
        
        <div className="flex items-center gap-3 mb-4">
          <Code className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">API Documentation</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Technical documentation for the AI Product Description Generator
        </p>
      </div>

      <div className="space-y-8">
        {/* Overview */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Overview</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Our AI Product Description Generator is powered by OpenAI's GPT-4 Vision API. 
              This application provides a user-friendly interface for generating professional 
              e-commerce product descriptions from images.
            </p>
            
            <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-blue-800 dark:text-blue-200">
                <strong>Note:</strong> This application uses OpenAI's Vision API internally. 
                For direct API access and integration, please refer to OpenAI's official documentation.
              </p>
            </div>
          </div>
        </Card>

        {/* OpenAI API Documentation */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4">OpenAI Vision API</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              This application is built on top of OpenAI's powerful GPT-4 Vision API. 
              For direct API integration, advanced usage, and technical implementation details, 
              please refer to the official OpenAI documentation.
            </p>
            
            <div className="flex justify-center pt-4">
              <Button asChild className="gap-2">
                <a 
                  href="https://platform.openai.com/docs/guides/images-vision?api-mode=responses" 
                  target="_blank" 
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="h-4 w-4" />
                  View OpenAI Vision API Documentation
                </a>
              </Button>
            </div>
          </div>
        </Card>

        {/* How to Use This Application */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4">How to Use This Application</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              This application provides a simple interface for generating product descriptions:
            </p>
            
            <ol className="list-decimal pl-6 space-y-2">
              <li>Select your preferred language from the dropdown</li>
              <li>Enter the product category (e.g., "wireless headphones", "cotton dress")</li>
              <li>Add any certifications or special features (optional)</li>
              <li>Upload one or more product images (up to 10 images, 10MB each)</li>
              <li>Wait for the AI to analyze your images and generate descriptions</li>
            </ol>
            
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg mt-4">
              <p className="text-sm">
                <strong>Supported formats:</strong> JPG, PNG, WebP<br/>
                <strong>Supported languages:</strong> 25+ European languages<br/>
                <strong>Processing time:</strong> 5-15 seconds per upload
              </p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}