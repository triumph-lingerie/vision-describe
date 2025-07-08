import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";
import { ArrowLeft } from "lucide-react";

export default function Terms() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-8">

        <div className="prose prose-sm max-w-none dark:prose-invert">
          <h1 className="text-2xl font-bold text-foreground mb-6">Terms of Service</h1>
          <p className="text-muted-foreground mb-4">Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Service Description</h2>
          <p className="text-sm text-muted-foreground">
            Our AI Product Description Generator analyzes product images and creates marketing descriptions 
            using artificial intelligence. Results are generated for informational purposes.
          </p>
          
          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Usage Guidelines</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Use only for legitimate product description purposes</li>
            <li>• Do not upload inappropriate, illegal, or copyrighted content</li>
            <li>• Maximum 10 images per upload, 10MB each</li>
            <li>• Respect rate limits and fair usage</li>
          </ul>
          
          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">AI-Generated Content</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Descriptions are AI-generated and may contain inaccuracies</li>
            <li>• Review and edit all generated content before use</li>
            <li>• We do not guarantee accuracy or fitness for any purpose</li>
            <li>• You retain ownership of generated descriptions</li>
          </ul>
          
          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">API Requirements</h2>
          <p className="text-sm text-muted-foreground">
            You must provide your own OpenAI and Firecrawl API keys. 
            We are not responsible for API costs or usage limits from third-party services.
          </p>
          
          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Limitation of Liability</h2>
          <p className="text-sm text-muted-foreground">
            This service is provided "as is" without warranties. 
            We are not liable for any damages arising from use of generated content.
          </p>
          
          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Prohibited Uses</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Uploading harmful, illegal, or inappropriate content</li>
            <li>• Attempting to reverse engineer or abuse the service</li>
            <li>• Using generated content for misleading advertising</li>
          </ul>
          
          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Changes to Terms</h2>
          <p className="text-sm text-muted-foreground">
            We may update these terms at any time. Continued use constitutes acceptance of changes.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-8 mt-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <p className="text-sm text-muted-foreground">
                Copyright Vision Describe 2025
              </p>
            </div>

            <div className="flex items-center space-x-6">
              <Link
                href="/privacy"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                Privacy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                Terms
              </Link>
              <a
                href="https://platform.openai.com/docs/guides/images-vision?api-mode=responses"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors duration-150"
              >
                API Documentation
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}