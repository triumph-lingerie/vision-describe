import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ImageUpload } from "@/components/image-upload";
import { ImageResult } from "@/components/image-result";
import { ProductSettings } from "@/components/product-settings";
import { useTheme } from "@/components/theme-provider";
import { Image, Sun, Moon, Github } from "lucide-react";

export default function Home() {
  const [results, setResults] = useState<any[]>([]);
  const [settings, setSettings] = useState({ 
    language: "en", 
    category: "",
    certifications: [{ value: "" }],
  });
  const { theme, setTheme } = useTheme();

  const handleUploadComplete = (newResults: any[]) => {
    setResults((prev) => [...newResults, ...prev]);
  };

  const handleSettingsChange = (newSettings: any) => {
    setSettings(newSettings);
  };

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Image className="h-6 w-6 text-primary" />
                <h1 className="text-xl font-semibold text-foreground">Product Description Generator</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={toggleTheme}
                className="text-muted-foreground hover:text-foreground"
              >
                <Sun className="h-4 w-4 dark:hidden" />
                <Moon className="h-4 w-4 hidden dark:block" />
              </Button>
              
              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground"
                onClick={() => window.open('https://github.com', '_blank')}
              >
                <Github className="h-4 w-4 mr-2" />
                GitHub
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-8">
        
        {/* Hero Section */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-medium text-foreground mb-2">
            Product Description Generator
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl mx-auto">
            Generate professional e-commerce descriptions from product images using AI
          </p>
        </div>

        {/* Instructions Section */}
        <div className="bg-muted/50 rounded-lg p-6 mb-8">
          <h2 className="text-lg font-semibold mb-4 text-foreground">How to Use</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  1
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Select Language</h3>
                  <p className="text-sm text-muted-foreground">Choose the target language for your product description</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  2
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Enter Product Category</h3>
                  <p className="text-sm text-muted-foreground">Specify the product type (e.g., bra, panties, thong, bodysuit)</p>
                </div>
              </div>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  3
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Add Certifications</h3>
                  <p className="text-sm text-muted-foreground">Optional: Add quality certifications (e.g., OEKO-TEX®)</p>
                </div>
              </div>
              
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-primary text-primary-foreground rounded-full flex items-center justify-center text-sm font-medium">
                  4
                </div>
                <div>
                  <h3 className="font-medium text-foreground">Upload Images</h3>
                  <p className="text-sm text-muted-foreground">Upload 1-10 high-quality product images (max 10MB each)</p>
                </div>
              </div>
            </div>
          </div>
          

        </div>

        {/* Settings and Upload Section */}
        <div className="space-y-8">
          <ProductSettings 
            onSettingsChange={handleSettingsChange}
            defaultSettings={settings}
          />
          
          <ImageUpload 
            onUploadComplete={handleUploadComplete}
            language={settings.language}
            category={settings.category}
            certifications={settings.certifications}
          />

          {/* Results Section */}
          {results.length > 0 && (
            <div className="space-y-4">
              <h2 className="text-lg font-medium text-foreground">Results</h2>
              <div className="space-y-6">
                {results.map((result, index) => (
                  <ImageResult
                    key={result.id || `${result.originalName}-${index}`}
                    result={result}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-8 mt-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <p className="text-sm text-muted-foreground">
                Powered by <span className="font-medium">GPT-4 Vision</span>
              </p>
            </div>
            
            <div className="flex items-center space-x-6">
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
                Privacy Policy
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
                Terms of Service
              </a>
              <a href="#" className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150">
                API Documentation
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
