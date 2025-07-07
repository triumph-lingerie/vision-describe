import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Shield, Eye, Database, Globe, Mail, Clock } from "lucide-react";

export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Shield className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Privacy Policy</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Last updated: {new Date().toLocaleDateString('it-IT', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      <Card className="p-8 space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Eye className="h-6 w-6" />
            Raccolta delle Informazioni
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Il nostro servizio di Generatore di Descrizioni Prodotti AI raccoglie le seguenti informazioni:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Immagini di prodotti:</strong> Le foto che carichi per l'analisi AI</li>
              <li><strong>Preferenze di lingua:</strong> La lingua selezionata per le descrizioni</li>
              <li><strong>Categorie di prodotto:</strong> Le categorie che specifichi per i tuoi prodotti</li>
              <li><strong>Certificazioni:</strong> Eventuali certificazioni che inserisci per i prodotti</li>
              <li><strong>Descrizioni generate:</strong> Il contenuto creato dall'AI per i tuoi prodotti</li>
            </ul>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Database className="h-6 w-6" />
            Utilizzo delle Informazioni
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Utilizziamo le tue informazioni esclusivamente per:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Generare descrizioni di prodotti personalizzate tramite AI</li>
              <li>Migliorare la qualità e l'accuratezza dell'analisi delle immagini</li>
              <li>Fornire supporto tecnico quando richiesto</li>
              <li>Ottimizzare le prestazioni del servizio</li>
            </ul>
            <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <p className="text-blue-800 dark:text-blue-200">
                <strong>Importante:</strong> Non vendiamo, affittiamo o condividiamo le tue immagini o descrizioni con terze parti per scopi commerciali.
              </p>
            </div>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Globe className="h-6 w-6" />
            Servizi di Terze Parti
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Il nostro servizio utilizza le seguenti tecnologie di terze parti:
            </p>
            <div className="space-y-4">
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-2">OpenAI GPT-4 Vision</h3>
                <p className="text-sm">
                  Utilizziamo l'API di OpenAI per l'analisi delle immagini e la generazione delle descrizioni. 
                  Le immagini vengono inviate in forma sicura a OpenAI per l'elaborazione e non vengono memorizzate nei loro server.
                </p>
              </div>
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold text-foreground mb-2">Replit Hosting</h3>
                <p className="text-sm">
                  La nostra applicazione è ospitata su Replit, che fornisce infrastruttura cloud sicura 
                  per il funzionamento del servizio.
                </p>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Conservazione dei Dati
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              I tuoi dati vengono gestiti nel seguente modo:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li><strong>Sessione attiva:</strong> Le immagini e descrizioni rimangono in memoria durante l'utilizzo</li>
              <li><strong>Dopo la sessione:</strong> I dati vengono automaticamente eliminati alla chiusura dell'applicazione</li>
              <li><strong>Nessuna persistenza:</strong> Non manteniamo archivi permanenti delle tue immagini o descrizioni</li>
            </ul>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4">Sicurezza dei Dati</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Implementiamo misure di sicurezza appropriate per proteggere le tue informazioni:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Crittografia HTTPS per tutte le comunicazioni</li>
              <li>Elaborazione sicura delle immagini tramite API certificate</li>
              <li>Accesso limitato ai dati da parte del personale autorizzato</li>
              <li>Monitoraggio continuo della sicurezza dell'infrastruttura</li>
            </ul>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4">I Tuoi Diritti</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Hai diritto a:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Sapere quali informazioni raccogliamo e come le utilizziamo</li>
              <li>Richiedere la cancellazione immediata dei tuoi dati dalla sessione</li>
              <li>Limitare l'elaborazione delle tue informazioni</li>
              <li>Ricevere supporto per questioni relative alla privacy</li>
            </ul>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Mail className="h-6 w-6" />
            Contatti
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Per questioni relative alla privacy o per esercitare i tuoi diritti, contattaci:
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg">
              <p><strong>Email:</strong> privacy@ai-product-generator.com</p>
              <p><strong>Oggetto:</strong> "Privacy Policy - Richiesta informazioni"</p>
            </div>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4">Modifiche alla Privacy Policy</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Ci riserviamo il diritto di aggiornare questa Privacy Policy periodicamente. 
              Le modifiche significative verranno comunicate tramite:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Notifica nell'applicazione</li>
              <li>Aggiornamento della data di "ultima modifica"</li>
              <li>Comunicazione via email per modifiche sostanziali</li>
            </ul>
          </div>
        </section>
      </Card>
    </div>
  );
}