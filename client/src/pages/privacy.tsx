import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";
import { ArrowLeft } from "lucide-react";

export default function Privacy() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-8">
        <Link href="/">
          <Button variant="ghost" className="mb-6 p-0 h-auto text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Home
          </Button>
        </Link>
        <div className="prose prose-sm max-w-none dark:prose-invert">
          <h1 className="text-2xl font-bold text-foreground mb-6">Privacy Policy</h1>
          <p className="text-muted-foreground mb-4">Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Data We Collect</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Product images you upload (processed temporarily, deleted after analysis)</li>
            <li>• Generated descriptions and analysis results</li>
            <li>• Basic usage analytics (anonymous)</li>
          </ul>
          
          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">How We Use Your Data</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Generate AI product descriptions using OpenAI's Vision API</li>
            <li>• Improve service quality and user experience</li>
            <li>• Images are sent to OpenAI for analysis and automatically deleted</li>
          </ul>
          
          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Data Retention</h2>
          <p className="text-sm text-muted-foreground">
            Uploaded images are processed in real-time and not stored on our servers. 
            Generated descriptions are kept temporarily in session storage only.
          </p>
          
          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Your Rights (GDPR)</h2>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Right to access your data</li>
            <li>• Right to delete your data</li>
            <li>• Right to data portability</li>
            <li>• Right to object to processing</li>
          </ul>
          
          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Third-Party Services</h2>
          <p className="text-sm text-muted-foreground">
            We use OpenAI's Vision API and Firecrawl for content processing. 
            Please review their privacy policies for data handling practices.
          </p>
          
          <h2 className="text-lg font-semibold text-foreground mt-6 mb-3">Contact</h2>
          <p className="text-sm text-muted-foreground">
            For privacy concerns or data requests, contact us at your-email@domain.com
          </p>
        </div>
      </main>
    </div>
  );
}