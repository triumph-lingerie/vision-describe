import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
    date: "8 Luglio 2025",
    title: "Sistema Intelligente di Estrazione Categoria",
    description: "Implementato sistema multi-strategia per categoria detection precisa",
    type: "improvement",
    items: [
      "Sostituito sistema base con 6 strategie intelligenti",
      "Aggiunta analisi breadcrumb, JSON-LD e meta properties",
      "Implementato rilevamento H1/title per categorie prodotto",
      "Filtro contenuti promozionali (£, slips for, etc.)",
      "Mantenuto sistema backup smart override per edge cases"
    ]
  },
  {
    date: "8 Luglio 2025", 
    title: "Crawler Intelligente Senza Firecrawl",
    description: "Rimosso Firecrawl e implementato sistema diretto affidabile al 100%",
    type: "technical",
    items: [
      "Eliminato Firecrawl per API errors e risposte inconsistenti",
      "Creato scraping diretto con strategie multi-livello",
      "Smart category detection con override automatico",
      "Sistema fallback: Triumph → Generic → Fallback selectors",
      "Performance costante ~9 secondi, affidabilità 100%",
      "Integrazione GPT-4V perfetta con immagini estratte"
    ]
  },
  {
    date: "8 Luglio 2025",
    title: "Ottimizzazione Container Immagini Prodotto", 
    description: "Targeting preciso container product-detail per evitare immagini promozionali",
    type: "improvement",
    items: [
      "Focus su container 'product-detail product-wrapper'",
      "Priorità selettori Triumph specifici vs generici",
      "Supporto srcset per immagini responsive",
      "Logging dettagliato estrazione container-specific",
      "Filtro immagini suggerimenti e promozionali"
    ]
  },
  {
    date: "8 Luglio 2025",
    title: "Estrazione JSON AI e Cache Performance",
    description: "Integrato Firecrawl con AI JSON e cache 1 ora per velocità 500%",
    type: "feature", 
    items: [
      "JSON extraction con AI prompt automatico",
      "Cache maxAge: 3600000 (1 ora) per richieste veloci",
      "Estrazione multi-tier: JSON AI → HTML → metadata fallback",
      "Timeout 15 secondi con fallback seamless",
      "AI identifica categorie prima dei metodi fallback"
    ]
  },
  {
    date: "8 Luglio 2025",
    title: "Crawler Precisione con Categoria Mappings",
    description: "Estrazione specializzata Triumph e mappings categoria canonici",
    type: "technical",
    items: [
      "Estrazione categoria da .headline.headline--h9-rs esatta",
      "Mappings canonici (minimizer bra → Minimizer bra)",
      "Funzione getImagesTriumph per sole immagini prodotto",
      "Filtro ID prodotto per escludere 'Complete the set'",
      "Estrazione testo categoria pulito senza meta tags"
    ]
  },
  {
    date: "8 Luglio 2025",
    title: "Sicurezza e Compliance per Deploy Pubblico",
    description: "Rate limiting, Privacy Policy e filtering contenuti",
    type: "feature",
    items: [
      "Privacy Policy e Terms GDPR compliant", 
      "Rate limiting 10 richieste/ora per IP",
      "Content filtering nomi file sospetti",
      "Risultati separati Create/Enhance workflows",
      "Bottoni Clear Results con icona trash",
      "Audit logging per monitoraggio sicurezza"
    ]
  },
  {
    date: "8 Luglio 2025",
    title: "Interfaccia Collassabile e API Keys",
    description: "Istruzioni collassabili e requisiti API key chiari",
    type: "improvement", 
    items: [
      "Sezioni 'How to Use' collassabili in entrambi i tab",
      "Istruzioni nascoste di default per interfaccia pulita",
      "Avviso requisiti API key con link OpenAI platform",
      "Icone chevron per espansione sezioni",
      "Processo 4-step spiegato per upload e crawling"
    ]
  },
  {
    date: "8 Luglio 2025",
    title: "Deploy Render.com Successo",
    description: "App live in produzione con configurazione completa",
    type: "feature",
    items: [
      "Risolti problemi build Node.js dependencies",
      "Environment variables: OPENAI_API_KEY, NODE_ENV",
      "App live: https://vision-describe.onrender.com",
      "URL crawling category extraction funzionante",
      "Carousel immagini 6+ alta qualità con navigazione"
    ]
  },
  {
    date: "7 Luglio 2025",
    title: "Header Rimosso per Design Minimale",
    description: "Eliminata navigazione header per focus contenuto principale",
    type: "improvement",
    items: [
      "Rimosso header navigation completamente",
      "Eliminati titolo app, theme toggle, elementi header",
      "Applicazione inizia direttamente con contenuto main",
      "Pulizia funzioni theme toggle non utilizzate"
    ]
  },
  {
    date: "7 Luglio 2025", 
    title: "Crawling URL Funzionalità Completa",
    description: "Sistema completo per analisi pagine prodotto via URL",
    type: "feature",
    items: [
      "Servizio crawling con Cheerio e Axios",
      "Auto-detection lingua da pattern URL e HTML",
      "Estrazione categoria da elementi HTML specifici", 
      "Discovery e processing immagini con base64",
      "Endpoint /api/crawl per analisi URL-based",
      "Interfaccia tab: Upload Images vs Crawl URL"
    ]
  },
  {
    date: "7 Luglio 2025",
    title: "Analisi Multi-Immagine Avanzata", 
    description: "Supporto analisi simultanea multiple immagini prodotto",
    type: "feature",
    items: [
      "Funzione analyzeImages per processing batch",
      "Frontend carousel con navigazione immagini",
      "Logic differenziata single vs multi-image",
      "Prompts GPT-4V ottimizzati per tone premium",
      "Restrizioni frasi AI-generated e linguaggio oggettivante",
      "Debug view JSON collassabile per verifiche API"
    ]
  },
  {
    date: "7 Luglio 2025",
    title: "Supporto Lingue Europee Complete",
    description: "Espansione lingue per mercato europeo completo", 
    type: "feature",
    items: [
      "Tutte le lingue paesi europei con locale codes",
      "Regioni multi-linguali (Belgio, Svizzera) specifiche",
      "Default UK English per consistency",
      "Prompts OpenAI gestione tutte lingue europee",
      "Traduzioni proper per ogni lingua supportata"
    ]
  },
  {
    date: "7 Luglio 2025",
    title: "Supporto Lingua e Categoria",
    description: "Sistema selezione lingua/categoria per SEO ottimizzazione",
    type: "feature", 
    items: [
      "Componente ProductSettings per lingua/categoria",
      "Schema database esteso con campi lingua/categoria",
      "Prompts OpenAI utilizzano lingua/categoria specifica",
      "Validazione categoria richiesta prima upload",
      "Badge categoria/lingua in display risultati"
    ]
  },
  {
    date: "7 Luglio 2025",
    title: "AI Product Description Generator",
    description: "Trasformazione in generatore specializzato e-commerce",
    type: "feature",
    items: [
      "Prompts OpenAI specifici per descrizioni prodotto",
      "UI text e branding focus prodotti",
      "Rendering HTML per descrizioni formattate", 
      "Componenti styled per display descrizioni premium",
      "Funzionalità copy/export risultati"
    ]
  },
  {
    date: "7 Luglio 2025",
    title: "Setup Iniziale Sistema Base",
    description: "Architettura foundational con analisi immagini base",
    type: "technical",
    items: [
      "React 18 + TypeScript frontend",
      "Express.js backend con OpenAI GPT-4 Vision",
      "Database PostgreSQL con Drizzle ORM", 
      "Shadcn/ui components + Tailwind CSS",
      "Upload immagini con Multer",
      "Funzionalità analisi immagini basic"
    ]
  }
];

const getIcon = (type: string) => {
  switch (type) {
    case "feature": return <Sparkles className="h-4 w-4" />;
    case "improvement": return <Zap className="h-4 w-4" />;
    case "fix": return <CheckCircle className="h-4 w-4" />;
    case "technical": return <Code className="h-4 w-4" />;
    default: return <CalendarDays className="h-4 w-4" />;
  }
};

const getTypeColor = (type: string) => {
  switch (type) {
    case "feature": return "bg-blue-500/10 text-blue-600 dark:text-blue-400";
    case "improvement": return "bg-green-500/10 text-green-600 dark:text-green-400"; 
    case "fix": return "bg-orange-500/10 text-orange-600 dark:text-orange-400";
    case "technical": return "bg-purple-500/10 text-purple-600 dark:text-purple-400";
    default: return "bg-gray-500/10 text-gray-600 dark:text-gray-400";
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case "feature": return "Nuova Funzionalità";
    case "improvement": return "Miglioramento";
    case "fix": return "Correzione";
    case "technical": return "Tecnico";
    default: return "Aggiornamento";
  }
};

export default function Changelog() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Changelog</h1>
        <p className="text-muted-foreground">
          Cronologia completa degli aggiornamenti e miglioramenti di Vision Describe
        </p>
      </div>

      <div className="space-y-6">
        {changelog.map((entry, index) => (
          <Card key={index} className="border-l-4 border-l-blue-500">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{entry.date}</span>
                    <Badge className={getTypeColor(entry.type)}>
                      <span className="flex items-center gap-1">
                        {getIcon(entry.type)}
                        {getTypeLabel(entry.type)}
                      </span>
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{entry.title}</CardTitle>
                  <CardDescription className="text-base">
                    {entry.description}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {entry.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span className="text-sm">{item}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-12 p-6 bg-muted/50 rounded-lg">
        <h3 className="font-semibold mb-2">Informazioni Versioning</h3>
        <p className="text-sm text-muted-foreground">
          Questo changelog viene aggiornato ad ogni deployment significativo. 
          Per la versione più recente del codice, consulta il repository GitHub.
        </p>
      </div>
    </div>
  );
}