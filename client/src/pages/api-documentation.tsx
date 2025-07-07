import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Code, Server, Zap, Key, Database, AlertCircle, CheckCircle, Globe } from "lucide-react";

export default function ApiDocumentation() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Code className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">API Documentation</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Documentazione completa per l'API del Generatore di Descrizioni Prodotti AI
        </p>
      </div>

      <div className="space-y-8">
        {/* Overview */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Server className="h-6 w-6" />
            Panoramica API
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              La nostra API REST permette di integrare il sistema di generazione descrizioni prodotti 
              direttamente nelle tue applicazioni e-commerce. Tutti gli endpoint utilizzano il protocollo HTTPS 
              e restituiscono dati in formato JSON.
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-2">Base URL</h3>
                <code className="text-sm bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                  https://your-app.replit.app/api
                </code>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-2">Formato Dati</h3>
                <Badge variant="secondary">JSON</Badge>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-2">Autenticazione</h3>
                <Badge variant="outline">API Key (futuro)</Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Authentication */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Key className="h-6 w-6" />
            Autenticazione
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-blue-800 dark:text-blue-200">
                <strong>Nota:</strong> Attualmente l'API è in versione beta e non richiede autenticazione. 
                In futuro sarà necessaria una API key per l'accesso.
              </p>
            </div>
            
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-foreground mb-3">Futura Implementazione</h3>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
                <code className="text-sm">
                  curl -H "Authorization: Bearer YOUR_API_KEY" \<br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;https://your-app.replit.app/api/images/analyze
                </code>
              </div>
            </div>
          </div>
        </Card>

        {/* Endpoints */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-6 flex items-center gap-2">
            <Zap className="h-6 w-6" />
            Endpoints Disponibili
          </h2>

          {/* POST /api/images/analyze */}
          <div className="space-y-6">
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Badge className="bg-green-500">POST</Badge>
                <code className="text-lg font-mono">/api/images/analyze</code>
              </div>
              
              <p className="text-muted-foreground mb-6">
                Analizza immagini di prodotti e genera descrizioni professionali multilingue.
              </p>

              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold mb-3">Parametri di Input</h4>
                  <div className="space-y-3">
                    <div className="border rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="font-mono text-sm">images</code>
                        <Badge variant="destructive" className="text-xs">Required</Badge>
                        <Badge variant="outline" className="text-xs">File[]</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Array di immagini (max 10 file, 10MB ciascuno). Formati: JPG, PNG, WebP
                      </p>
                    </div>
                    
                    <div className="border rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="font-mono text-sm">language</code>
                        <Badge variant="secondary" className="text-xs">Optional</Badge>
                        <Badge variant="outline" className="text-xs">String</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Codice lingua (es: 'en', 'it', 'fr', 'de'). Default: 'en'
                      </p>
                    </div>
                    
                    <div className="border rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="font-mono text-sm">category</code>
                        <Badge variant="destructive" className="text-xs">Required</Badge>
                        <Badge variant="outline" className="text-xs">String</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Categoria del prodotto (es: 'bra', 'panties', 'dress')
                      </p>
                    </div>
                    
                    <div className="border rounded p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <code className="font-mono text-sm">certifications</code>
                        <Badge variant="secondary" className="text-xs">Optional</Badge>
                        <Badge variant="outline" className="text-xs">String</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Certificazioni del prodotto (es: 'OEKO-TEX® STANDARD 100')
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold mb-3">Esempio di Richiesta</h4>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm"><code>{`curl -X POST https://your-app.replit.app/api/images/analyze \\
  -F "images=@product1.jpg" \\
  -F "images=@product2.jpg" \\
  -F "language=it" \\
  -F "category=reggiseno imbottito" \\
  -F "certifications=OEKO-TEX® STANDARD 100"`}</code></pre>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold mb-3">Risposta di Successo (200)</h4>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm"><code>{`{
  "results": [
    {
      "id": 1,
      "originalName": "product1.jpg",
      "description": "Questo reggiseno imbottito offre comfort...",
      "extractedFeatures": [
        "Design senza fili per comfort ottimale",
        "Spalline regolabili per vestibilità personalizzata"
      ],
      "wordCount": 156,
      "createdAt": "2025-07-07T18:30:00Z",
      "fileSize": 245760,
      "language": "it",
      "category": "reggiseno imbottito",
      "certifications": "OEKO-TEX® STANDARD 100",
      "imageData": "data:image/jpeg;base64,/9j/4AAQ...",
      "allImages": ["data:image/jpeg;base64,..."],
      "isMultiImage": true,
      "imageCount": 2
    }
  ]
}`}</code></pre>
                  </div>
                </div>
              </div>
            </div>

            {/* GET /api/images */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Badge className="bg-blue-500">GET</Badge>
                <code className="text-lg font-mono">/api/images</code>
              </div>
              
              <p className="text-muted-foreground mb-6">
                Recupera tutte le analisi di immagini della sessione corrente.
              </p>

              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold mb-3">Esempio di Richiesta</h4>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm"><code>curl https://your-app.replit.app/api/images</code></pre>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold mb-3">Risposta di Successo (200)</h4>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm"><code>{`{
  "images": [
    {
      "id": 1,
      "filename": "1720374600000-product1.jpg",
      "originalName": "product1.jpg",
      "description": "Questo reggiseno imbottito...",
      "language": "it",
      "category": "reggiseno imbottito",
      "createdAt": "2025-07-07T18:30:00Z"
    }
  ]
}`}</code></pre>
                  </div>
                </div>
              </div>
            </div>

            {/* GET /api/images/:id */}
            <div className="border rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <Badge className="bg-blue-500">GET</Badge>
                <code className="text-lg font-mono">/api/images/:id</code>
              </div>
              
              <p className="text-muted-foreground mb-6">
                Recupera una specifica analisi di immagine tramite ID.
              </p>

              <div className="space-y-6">
                <div>
                  <h4 className="text-lg font-semibold mb-3">Parametri URL</h4>
                  <div className="border rounded p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <code className="font-mono text-sm">id</code>
                      <Badge variant="destructive" className="text-xs">Required</Badge>
                      <Badge variant="outline" className="text-xs">Integer</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      ID univoco dell'analisi immagine
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-lg font-semibold mb-3">Esempio di Richiesta</h4>
                  <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                    <pre className="text-sm"><code>curl https://your-app.replit.app/api/images/1</code></pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Error Codes */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="h-6 w-6" />
            Codici di Errore
          </h2>
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="border rounded p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="destructive">400</Badge>
                  <span className="font-semibold">Bad Request</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Richiesta malformata o parametri mancanti
                </p>
              </div>

              <div className="border rounded p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="destructive">413</Badge>
                  <span className="font-semibold">Payload Too Large</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  File troppo grande (&gt;10MB) o troppi file (&gt;10)
                </p>
              </div>

              <div className="border rounded p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="destructive">415</Badge>
                  <span className="font-semibold">Unsupported Media Type</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Formato file non supportato
                </p>
              </div>

              <div className="border rounded p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="destructive">500</Badge>
                  <span className="font-semibold">Internal Server Error</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Errore nell'elaborazione AI o server
                </p>
              </div>
            </div>

            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-3">Esempio di Risposta di Errore</h3>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm"><code>{`{
  "error": "Bad Request",
  "message": "Category is required",
  "code": 400,
  "timestamp": "2025-07-07T18:30:00Z"
}`}</code></pre>
              </div>
            </div>
          </div>
        </Card>

        {/* Rate Limits & Best Practices */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Database className="h-6 w-6" />
            Limitazioni e Best Practices
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">Limitazioni Tecniche</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Massimo 10 immagini per richiesta</li>
                <li>Dimensione massima file: 10MB</li>
                <li>Formati supportati: JPG, PNG, WebP</li>
                <li>Timeout richiesta: 60 secondi</li>
                <li>Rate limit: attualmente non implementato (beta)</li>
              </ul>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Best Practices</h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Ottimizza le immagini</p>
                    <p className="text-sm text-muted-foreground">
                      Riduci le dimensioni dei file mantenendo buona qualità per tempi di risposta più rapidi
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Gestisci gli errori</p>
                    <p className="text-sm text-muted-foreground">
                      Implementa retry logic e gestione errori appropriata per robustezza
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Specifica categorie precise</p>
                    <p className="text-sm text-muted-foreground">
                      Usa categorie dettagliate per descrizioni più accurate (es: "reggiseno push-up" vs "abbigliamento")
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                  <div>
                    <p className="font-medium">Monitora i tempi di risposta</p>
                    <p className="text-sm text-muted-foreground">
                      L'elaborazione AI può richiedere 5-15 secondi, pianifica di conseguenza
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* SDKs and Examples */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Globe className="h-6 w-6" />
            Esempi di Integrazione
          </h2>
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-3">JavaScript/TypeScript</h3>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm"><code>{`// Esempio con fetch API
async function analyzeProduct(imageFile, options = {}) {
  const formData = new FormData();
  formData.append('images', imageFile);
  formData.append('language', options.language || 'en');
  formData.append('category', options.category);
  
  if (options.certifications) {
    formData.append('certifications', options.certifications);
  }

  try {
    const response = await fetch('/api/images/analyze', {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    const result = await response.json();
    return result.results[0];
  } catch (error) {
    console.error('Error analyzing product:', error);
    throw error;
  }
}`}</code></pre>
              </div>
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-3">Python</h3>
              <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-x-auto">
                <pre className="text-sm"><code>{`import requests

def analyze_product(image_path, language='en', category='product', certifications=None):
    url = 'https://your-app.replit.app/api/images/analyze'
    
    with open(image_path, 'rb') as image_file:
        files = {'images': image_file}
        data = {
            'language': language,
            'category': category
        }
        
        if certifications:
            data['certifications'] = certifications
        
        response = requests.post(url, files=files, data=data)
        response.raise_for_status()
        
        return response.json()['results'][0]

# Utilizzo
result = analyze_product(
    'product.jpg', 
    language='it', 
    category='reggiseno',
    certifications='OEKO-TEX® STANDARD 100'
)`}</code></pre>
              </div>
            </div>
          </div>
        </Card>

        {/* Support */}
        <Card className="p-6">
          <h2 className="text-2xl font-semibold mb-4">Supporto e Contatti</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Per supporto tecnico, bug report o richieste di funzionalità:
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-2">
              <p><strong>Email Tecnico:</strong> api-support@ai-product-generator.com</p>
              <p><strong>Documentazione:</strong> Questa pagina viene aggiornata regolarmente</p>
              <p><strong>Status Page:</strong> status.ai-product-generator.com (futuro)</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}