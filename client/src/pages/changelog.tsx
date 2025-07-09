import { Link } from "wouter";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/header";
import { CalendarDays, CheckCircle, Code, Sparkles, Zap } from "lucide-react";

interface ChangelogEntry {
  date: string;
  version?: string;
  title: string;
  description: string;
  items: string[];
  type: "feature" | "improvement" | "fix" | "technical";
}

const changelog: ChangelogEntry[] = [
  {
    date: "July 8, 2025",
    title: "Intelligent Category Extraction System",
    description:
      "Implemented multi-strategy system for precise category detection",
    type: "improvement",
    items: [
      "Replaced basic system with 6 intelligent strategies",
      "Added breadcrumb, JSON-LD and meta properties analysis",
      "Implemented H1/title detection for product categories",
      "Filter promotional content (£, slips for, etc.)",
      "Maintained smart override backup system for edge cases",
    ],
  },
  {
    date: "July 8, 2025",
    title: "Intelligent Crawler Without Firecrawl",
    description:
      "Removed Firecrawl and implemented 100% reliable direct system",
    type: "technical",
    items: [
      "Eliminated Firecrawl due to API errors and inconsistent responses",
      "Created direct scraping with multi-level strategies",
      "Smart category detection with automatic override",
      "Fallback system: Triumph → Generic → Fallback selectors",
      "Consistent ~9 second performance, 100% reliability",
      "Perfect GPT-4V integration with extracted images",
    ],
  },
  {
    date: "July 8, 2025",
    title: "Product Image Container Optimization",
    description:
      "Precise targeting of product-detail containers to avoid promotional images",
    type: "improvement",
    items: [
      "Focus on 'product-detail product-wrapper' containers",
      "Priority for Triumph-specific vs generic selectors",
      "Srcset support for responsive images",
      "Detailed logging for container-specific extraction",
      "Filter suggestion and promotional images",
    ],
  },
  {
    date: "July 8, 2025",
    title: "AI JSON Extraction and Performance Cache",
    description:
      "Integrated Firecrawl with AI JSON and 1-hour cache for 500% speed boost",
    type: "feature",
    items: [
      "JSON extraction with automatic AI prompts",
      "Cache maxAge: 3600000 (1 hour) for fast requests",
      "Multi-tier extraction: AI JSON → HTML → metadata fallback",
      "15-second timeout with seamless fallback",
      "AI identifies categories before fallback methods",
    ],
  },
  {
    date: "July 8, 2025",
    title: "Precision Crawler with Category Mappings",
    description:
      "Specialized Triumph extraction and canonical category mappings",
    type: "technical",
    items: [
      "Exact category extraction from .headline.headline--h9-rs",
      "Canonical mappings (minimizer bra → Minimizer bra)",
      "getImagesTriumph function for product images only",
      "Product ID filter to exclude 'Complete the set'",
      "Clean category text extraction without meta tags",
    ],
  },
  {
    date: "July 8, 2025",
    title: "Security and Compliance for Public Deploy",
    description: "Rate limiting, Privacy Policy and content filtering",
    type: "feature",
    items: [
      "GDPR compliant Privacy Policy and Terms",
      "Rate limiting 10 requests/hour per IP",
      "Content filtering for suspicious filenames",
      "Separate results for Create/Enhance workflows",
      "Clear Results buttons with trash icon",
      "Audit logging for security monitoring",
    ],
  },
  {
    date: "July 8, 2025",
    title: "Collapsible Interface and API Keys",
    description: "Collapsible instructions and clear API key requirements",
    type: "improvement",
    items: [
      "Collapsible 'How to Use' sections in both tabs",
      "Instructions hidden by default for clean interface",
      "API key requirements notice with OpenAI platform link",
      "Chevron icons for section expansion",
      "4-step process explained for upload and crawling",
    ],
  },
  {
    date: "July 8, 2025",
    title: "Successful Render.com Deploy",
    description: "Live app in production with complete configuration",
    type: "feature",
    items: [
      "Resolved Node.js dependencies build issues",
      "Environment variables: OPENAI_API_KEY, NODE_ENV",
      "Live app: https://vision-describe.onrender.com",
      "Working URL crawling category extraction",
      "6+ high-quality image carousel with navigation",
    ],
  },
  {
    date: "July 7, 2025",
    title: "Header Removed for Minimal Design",
    description: "Eliminated header navigation to focus on main content",
    type: "improvement",
    items: [
      "Completely removed header navigation",
      "Eliminated app title, theme toggle, header elements",
      "Application starts directly with main content",
      "Cleaned up unused theme toggle functions",
    ],
  },
  {
    date: "July 7, 2025",
    title: "Complete URL Crawling Functionality",
    description: "Complete system for product page analysis via URL",
    type: "feature",
    items: [
      "Crawling service with Cheerio and Axios",
      "Auto-detection of language from URL patterns and HTML",
      "Category extraction from specific HTML elements",
      "Image discovery and processing with base64",
      "/api/crawl endpoint for URL-based analysis",
      "Tab interface: Upload Images vs Crawl URL",
    ],
  },
  {
    date: "July 7, 2025",
    title: "Advanced Multi-Image Analysis",
    description: "Support for simultaneous analysis of multiple product images",
    type: "feature",
    items: [
      "analyzeImages function for batch processing",
      "Frontend carousel with image navigation",
      "Differentiated logic for single vs multi-image",
      "Optimized GPT-4V prompts for premium tone",
      "Restrictions on AI-generated phrases and objectifying language",
      "Collapsible JSON debug view for API verification",
    ],
  },
  {
    date: "July 7, 2025",
    title: "Complete European Language Support",
    description: "Language expansion for complete European market",
    type: "feature",
    items: [
      "All European country languages with locale codes",
      "Specific multi-lingual regions (Belgium, Switzerland)",
      "Default UK English for consistency",
      "OpenAI prompts handle all European languages",
      "Proper translations for each supported language",
    ],
  },
  {
    date: "July 7, 2025",
    title: "Language and Category Support",
    description: "Language/category selection system for SEO optimization",
    type: "feature",
    items: [
      "ProductSettings component for language/category",
      "Extended database schema with language/category fields",
      "OpenAI prompts use specific language/category",
      "Category validation required before upload",
      "Category/language badges in results display",
    ],
  },
  {
    date: "July 7, 2025",
    title: "AI Product Description Generator",
    description: "Transformation into specialized e-commerce generator",
    type: "feature",
    items: [
      "OpenAI prompts specific for product descriptions",
      "UI text and branding focused on products",
      "HTML rendering for formatted descriptions",
      "Styled components for premium description display",
      "Copy/export functionality for results",
    ],
  },
  {
    date: "July 7, 2025",
    title: "Initial System Setup",
    description: "Foundational architecture with basic image analysis",
    type: "technical",
    items: [
      "React 18 + TypeScript frontend",
      "Express.js backend with OpenAI GPT-4 Vision",
      "PostgreSQL database with Drizzle ORM",
      "Shadcn/ui components + Tailwind CSS",
      "Image upload with Multer",
      "Basic image analysis functionality",
    ],
  },
];

const getIcon = (type: string) => {
  switch (type) {
    case "feature":
      return <Sparkles className="h-3 w-3" />;
    case "improvement":
      return <Zap className="h-3 w-3" />;
    case "fix":
      return <CheckCircle className="h-3 w-3" />;
    case "technical":
      return <Code className="h-3 w-3" />;
    default:
      return <CalendarDays className="h-3 w-3" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case "feature":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    case "improvement":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    case "fix":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    case "technical":
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case "feature":
      return "Feature";
    case "improvement":
      return "Improvement";
    case "fix":
      return "Fix";
    case "technical":
      return "Technical";
    default:
      return "Update";
  }
};

export default function Changelog() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl py-8">
        <div className="max-w-3xl mx-auto px-6 py-12">
          <div className="mb-12">
            <h1 className="text-2xl font-medium mb-3">Changelog</h1>
            <p className="text-muted-foreground  text-sm">
              Complete history of updates and improvements to VisionDescribe
            </p>
          </div>

          <div className="space-y-8">
            {changelog.map((entry, index) => (
              <div
                key={index}
                className="border-b border-gray-200 dark:border-gray-800 pb-8 last:border-b-0"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-2 h-2 bg-gray-400 rounded-full mt-2"></div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500">
                        {entry.date}
                      </span>
                      <Badge
                        variant="secondary"
                        className={`${getTypeColor(entry.type)} text-xs px-2 py-0.5`}
                      >
                        <span className="flex items-center gap-1">
                          {getIcon(entry.type)}
                          {getTypeLabel(entry.type)}
                        </span>
                      </Badge>
                    </div>

                    <h3 className="text-lg font-medium mb-1">{entry.title}</h3>
                    <p className="text-sm text-muted-foreground  mb-4">
                      {entry.description}
                    </p>

                    <ul className="space-y-1.5">
                      {entry.items.map((item, itemIndex) => (
                        <li key={itemIndex} className="flex items-start gap-2">
                          <div className="w-1 h-1 bg-gray-400 rounded-full mt-2 flex-shrink-0"></div>
                          <span className="text-sm text-gray-700 dark:text-gray-300">
                            {item}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-16 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800">
            <p className="text-xs text-muted-foreground ">
              This changelog is updated with each significant deployment. For
              the latest version of the code, check the GitHub repository.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border bg-muted/30 py-8 mt-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="flex flex-col sm:flex-row items-center justify-between space-y-4 sm:space-y-0">
            <div className="flex items-center space-x-2">
              <p className="text-sm text-muted-foreground">
                © {new Date().getFullYear()} Vision Describe.
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
