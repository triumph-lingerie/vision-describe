# AI Product Description Generator

## Overview

This is a full-stack web application specifically designed for e-commerce businesses to generate professional product descriptions from product images using OpenAI's GPT-4 Vision model. The AI analyzes product photos and creates marketing-ready descriptions with detailed feature lists in a premium brand style. The application features a modern Vercel-inspired React frontend with a Node.js/Express backend, utilizing in-memory storage for development.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **UI Framework**: Shadcn/ui components built on Radix UI primitives
- **Styling**: Tailwind CSS with CSS variables for theming
- **Build Tool**: Vite for development and production builds

### Backend Architecture
- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js for REST API
- **File Upload**: Multer for handling multipart form data
- **API Integration**: OpenAI GPT-4 Vision for image analysis
- **Database**: PostgreSQL with Drizzle ORM
- **Session Management**: Express sessions with PostgreSQL store

### Data Storage
- **Primary Database**: PostgreSQL with Neon Database serverless driver
- **ORM**: Drizzle ORM for type-safe database operations
- **Schema Management**: Drizzle Kit for migrations
- **Fallback Storage**: In-memory storage implementation for development

## Key Components

### Database Schema
- **Users Table**: Basic user management with username/password
- **Image Analyses Table**: Stores uploaded image metadata and AI-generated descriptions
  - Filename, original name, MIME type, file size
  - AI-generated description text
  - Creation timestamp

### API Endpoints
- `POST /api/images/analyze`: Upload and analyze product images
  - Accepts up to 10 product images (10MB limit each)
  - Generates professional e-commerce descriptions with feature lists
  - Returns marketing-ready content in premium brand style
  - Handles errors gracefully for individual files

### Frontend Components
- **ImageUpload**: Drag-and-drop interface for file uploads with progress tracking
- **ImageResult**: Display component for analysis results with copy/export functionality
- **Theme Provider**: Light/dark mode support with system preference detection

## Data Flow

1. **Product Image Upload**: Users drag/drop or select product photos through the upload interface
2. **File Processing**: Multer processes uploaded files into memory buffers
3. **AI Product Analysis**: Images are converted to base64 and sent to OpenAI GPT-4 Vision with specialized e-commerce prompting
4. **Description Generation**: AI generates professional product descriptions with feature lists in premium brand style
5. **Data Persistence**: Product analysis results are stored in memory storage
6. **Result Display**: Frontend displays results with HTML rendering for formatted descriptions, copy and export functionality

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL database driver
- **drizzle-orm**: Type-safe ORM and query builder
- **openai**: Official OpenAI API client
- **multer**: File upload middleware
- **@tanstack/react-query**: Server state management
- **wouter**: Lightweight React router

### UI Dependencies
- **@radix-ui/***: Headless UI components for accessibility
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Component variant management
- **lucide-react**: Icon library

### Development Tools
- **vite**: Build tool and development server
- **typescript**: Type safety and development experience
- **drizzle-kit**: Database schema management

## Deployment Strategy

### Build Process
- Frontend builds to `dist/public` using Vite
- Backend builds to `dist/index.js` using esbuild
- Single production command serves both frontend and API

### Environment Requirements
- `DATABASE_URL`: PostgreSQL connection string
- `OPENAI_API_KEY`: OpenAI API authentication
- Node.js runtime for Express server

### Development Setup
- `npm run dev`: Starts development server with hot reload
- `npm run db:push`: Applies database schema changes
- `npm run build`: Creates production build
- `npm start`: Runs production server

## Changelog
- July 07, 2025: Initial setup with basic image analysis functionality
- July 07, 2025: Transformed to specialized AI Product Description Generator
  - Modified OpenAI prompts for e-commerce product descriptions
  - Updated UI text and branding for product focus
  - Added HTML rendering support for formatted descriptions
  - Styled components for premium product description display
- July 07, 2025: Added language and category support
  - Created ProductSettings component for language and category selection
  - Extended database schema with language and category fields
  - Updated OpenAI prompts to use specified language and category for SEO optimization
  - Added validation to require category before upload
  - Enhanced UI with category/language badges in results display
- July 07, 2025: Updated language support to match European market requirements
  - Expanded language list to include all European countries with proper locale codes
  - Added support for multi-lingual regions (Belgium, Switzerland) with specific language variants
  - Changed default language from English to UK English for consistency
  - Updated OpenAI prompts to handle all European languages with proper translations
- July 07, 2025: Enhanced multi-image analysis capabilities
  - Added support for analyzing multiple product images simultaneously for comprehensive descriptions
  - Created new analyzeImages function that processes all images together vs individually
  - Frontend now displays image carousel with navigation for multiple uploaded images
  - Backend logic differentiates between single and multi-image uploads for optimal processing
  - UI improvements to encourage multi-image uploads for better product analysis
  - Added JSON debug view with collapsible section to verify API responses
  - Enhanced OpenAI prompts with professional SEO content optimizer guidelines
  - Integrated sophisticated tone of voice standards from premium fashion brands
  - Added restrictions against AI-generated phrases and objectifying language
  - Improved content structure requirements for professional e-commerce standards
- July 07, 2025: Simplified interface by removing auto-detect category feature
  - Removed auto-detect checkbox and related validation logic
  - Category field is now always required for manual input
  - AI still automatically corrects category if it detects a different product type from the image
  - Maintains smart verification but requires explicit user category input
  - Interface now has only Language, Product Category, and Certifications fields
- July 07, 2025: Fixed OpenAI Vision analysis issues
  - Updated prompts to require mandatory visual analysis of uploaded images
  - Removed conservative language that prevented detailed image analysis
  - Added explicit requirement for AI to describe what it sees in images
  - Enhanced product identification to use actual visual analysis instead of generic responses
  - Fixed issue where AI was providing generic descriptions instead of analyzing real product images
- July 07, 2025: Implemented language selection with flag animations
  - Added flag emojis for all supported European languages
  - Created smooth animations for language selection (celebration, bounce, wave effects)
  - Enhanced user experience with visual feedback for language changes
  - Implemented hover animations on dropdown flags with CSS keyframes
- July 07, 2025: Simplified footer with direct external links
  - Removed API documentation page entirely per user request
  - Added direct link to OpenAI's Vision API documentation (https://platform.openai.com/docs/guides/images-vision?api-mode=responses)
  - "GPT-4 Vision" text now links to OpenAI's GPT-4V system card (https://openai.com/index/gpt-4v-system-card/)
  - Footer now contains only external links with proper target="_blank" attributes
  - Cleaned up routing to remove unused documentation pages
- July 07, 2025: Removed flag emojis from language selection
  - Eliminated all flag emojis from language dropdown per user preference
  - Removed flag animation logic and CSS keyframes
  - Simplified language selection to show only language names
  - Cleaned up component state management by removing flag-related variables
- July 07, 2025: Removed entire header section
  - Completely removed header navigation per user request
  - Eliminated app title, theme toggle, and all header elements
  - Application now starts directly with main content
  - Cleaned up unused theme toggle functions and imports
- July 08, 2025: Added URL crawling functionality
  - Implemented web crawling service with Cheerio and Axios for product page analysis
  - Added automatic language detection from URL patterns and HTML attributes
  - Created category extraction from specific HTML elements (div.headline.headline--h9-rs)
  - Built image discovery and processing from product pages with base64 conversion
  - Added new /api/crawl endpoint for URL-based product analysis
  - Created UrlCrawler component with clean input interface and error handling
  - Implemented tab interface to switch between image upload and URL crawling methods
  - Updated "How to Use" section to explain both input methods
  - Enhanced application to support dual input: direct image upload or URL crawling
- July 08, 2025: Optimized URL crawling with smart filters and category detection
  - Fixed frontend API request error in UrlCrawler component 
  - Added enhanced image filtering to remove placeholder images and data URLs
  - Implemented smart category override for Triumph products using title/meta description analysis
  - Added specific selectors for product image containers (.pdp__imageContainer, .js-tileImageCarousel)
  - Created banner/promotional image filtering to focus on actual product images
  - Successfully tested with Triumph product pages - correct category "Non-wired bra" extraction
  - System now accurately detects product type and generates professional descriptions
  - Fixed capitalization in OpenAI descriptions: "This non-wired bra" instead of "This Non-wired bra"
  - Improved image deduplication logic for Triumph carousel images
  - Added carousel image pattern generation for Triumph products to capture multiple product views
  - Enhanced carousel extraction to use real DOM thumbnail selectors instead of pattern guessing
  - Improved OpenAI prompt to reduce content policy rejections and generate consistent descriptions
  - Frontend carosello interface with navigation arrows, indicators, and image counter fully functional
  - System now extracts 6-10 real product images from Triumph carousel and displays them navigably

## User Preferences

Preferred communication style: Simple, everyday language.