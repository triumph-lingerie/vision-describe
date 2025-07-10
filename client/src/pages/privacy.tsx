import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-8">
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <h1 className="text-2xl font-bold text-foreground mb-6">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground mb-4">
            Last updated: {new Date().toLocaleDateString()}
          </p>

          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">
            Data We Collect
          </h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>
              Product images you upload (processed temporarily, deleted after
              analysis)
            </li>
            <li>Generated descriptions and analysis results</li>
            <li>Basic usage analytics (anonymous)</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">
            How We Use Your Data
          </h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>Generate AI product descriptions using OpenAI's Vision API</li>
            <li>Improve service quality and user experience</li>
            <li>
              Images are sent to OpenAI for analysis and automatically deleted
            </li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">
            Data Retention
          </h2>
          <p className="text-sm text-muted-foreground">
            Uploaded images are processed in real-time and not stored on our
            servers. Generated descriptions are kept temporarily in session
            storage only.
          </p>

          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">
            Your Rights (GDPR)
          </h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>Right to access your data</li>
            <li>Right to delete your data</li>
            <li>Right to data portability</li>
            <li>Right to object to processing</li>
          </ul>

          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">
            Third-Party Services
          </h2>
          <p className="text-sm text-muted-foreground">
            We use OpenAI's Vision API and Firecrawl for content processing.
            Please review their privacy policies for data handling practices.
          </p>

          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">
            Contact
          </h2>
          <p className="text-sm text-muted-foreground">
            For privacy concerns or data requests, contact us at
            your-email@domain.com
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-8 mt-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} VisionDescribe.
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
                API Docs
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
