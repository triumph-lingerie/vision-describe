import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FileText, Users, AlertTriangle, Scale, Zap, CreditCard } from "lucide-react";

export default function TermsOfService() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <FileText className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">Termini di Servizio</h1>
        </div>
        <p className="text-muted-foreground text-lg">
          Ultimo aggiornamento: {new Date().toLocaleDateString('it-IT', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}
        </p>
      </div>

      <Card className="p-8 space-y-8">
        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Users className="h-6 w-6" />
            Accettazione dei Termini
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Utilizzando il nostro Generatore di Descrizioni Prodotti AI ("Servizio"), accetti integralmente 
              questi Termini di Servizio ("Termini"). Se non accetti questi termini, non utilizzare il servizio.
            </p>
            <div className="bg-amber-50 dark:bg-amber-950/30 p-4 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-amber-800 dark:text-amber-200">
                <strong>Attenzione:</strong> L'utilizzo continuato del servizio costituisce accettazione 
                automatica di eventuali modifiche ai presenti termini.
              </p>
            </div>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Zap className="h-6 w-6" />
            Descrizione del Servizio
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Il nostro servizio fornisce:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Analisi automatica di immagini di prodotti tramite AI</li>
              <li>Generazione di descrizioni professionali per e-commerce</li>
              <li>Supporto multilingue per mercati europei</li>
              <li>Personalizzazione per categorie di prodotto specifiche</li>
              <li>Integrazione di certificazioni e specifiche tecniche</li>
            </ul>
            <p>
              Il servizio è progettato per aziende e professionisti che necessitano di contenuti 
              di qualità per la vendita online.
            </p>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4">Utilizzo Consentito</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Puoi utilizzare il servizio per:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Creare descrizioni di prodotti per uso commerciale legittimo</li>
              <li>Generare contenuti per e-commerce, cataloghi e materiale marketing</li>
              <li>Analizzare prodotti di moda, lingerie e abbigliamento</li>
              <li>Integrare le descrizioni nei tuoi sistemi di vendita</li>
            </ul>
            
            <div className="mt-6">
              <h3 className="text-lg font-semibold text-foreground mb-3">Limitazioni d'Uso</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Massimo 10 immagini per richiesta</li>
                <li>Dimensione massima file: 10MB per immagine</li>
                <li>Formati supportati: JPG, PNG, WebP</li>
                <li>Uso personale o commerciale legittimo esclusivamente</li>
              </ul>
            </div>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6" />
            Comportamenti Vietati
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              È rigorosamente vietato:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Caricare immagini inappropriate, illegali o che violano diritti di terzi</li>
              <li>Tentare di aggirare le limitazioni tecniche del servizio</li>
              <li>Utilizzare il servizio per attività fraudolente o ingannevoli</li>
              <li>Rivendere o ridistribuire l'accesso al servizio senza autorizzazione</li>
              <li>Sovraccaricare l'infrastruttura con richieste eccessive</li>
              <li>Reverse engineering o tentative di accesso non autorizzato</li>
            </ul>
            
            <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg border border-red-200 dark:border-red-800 mt-4">
              <p className="text-red-800 dark:text-red-200">
                <strong>Conseguenze:</strong> La violazione di questi termini comporta la sospensione 
                immediata dell'accesso al servizio senza preavviso.
              </p>
            </div>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4">Proprietà Intellettuale</h2>
          <div className="space-y-4 text-muted-foreground">
            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Contenuti Generati</h3>
                <p>
                  Le descrizioni prodotte dall'AI diventano di tua proprietà e puoi utilizzarle 
                  liberamente per scopi commerciali. Non rivendichiamo diritti sui contenuti generati.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Immagini Caricate</h3>
                <p>
                  Mantieni tutti i diritti sulle immagini che carichi. Garantisci di avere 
                  l'autorizzazione necessaria per l'uso delle immagini caricate.
                </p>
              </div>
              
              <div>
                <h3 className="text-lg font-semibold text-foreground mb-2">Tecnologia del Servizio</h3>
                <p>
                  Il software, algoritmi e tecnologia utilizzati rimangono di nostra esclusiva proprietà 
                  o dei rispettivi licenzianti (OpenAI, Replit, etc.).
                </p>
              </div>
            </div>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <Scale className="h-6 w-6" />
            Limitazione di Responsabilità
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Il servizio è fornito "così com'è" senza garanzie di alcun tipo. Limitiamo la nostra responsabilità per:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Accuratezza o completezza delle descrizioni generate</li>
              <li>Interruzioni temporanee del servizio per manutenzione</li>
              <li>Perdite commerciali derivanti dall'uso delle descrizioni</li>
              <li>Compatibilità con sistemi di terze parti</li>
            </ul>
            
            <div className="bg-blue-50 dark:bg-blue-950/30 p-4 rounded-lg border border-blue-200 dark:border-blue-800 mt-4">
              <p className="text-blue-800 dark:text-blue-200">
                <strong>Importante:</strong> È tua responsabilità verificare e adattare le descrizioni 
                generate prima dell'uso commerciale.
              </p>
            </div>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4 flex items-center gap-2">
            <CreditCard className="h-6 w-6" />
            Tariffe e Pagamenti
          </h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Il servizio è attualmente fornito gratuitamente durante la fase beta. 
              In futuro potrebbero essere introdotte tariffe per:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Elaborazione di volumi elevati di immagini</li>
              <li>Funzionalità premium e personalizzazioni avanzate</li>
              <li>Supporto prioritario e SLA garantiti</li>
              <li>Integrazioni API per automazione</li>
            </ul>
            <p>
              Gli utenti esistenti riceveranno 30 giorni di preavviso prima dell'introduzione di tariffe.
            </p>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4">Disponibilità del Servizio</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Ci impegniamo a fornire un servizio affidabile, tuttavia:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Possono verificarsi interruzioni per manutenzione programmata</li>
              <li>La disponibilità dipende da servizi di terze parti (OpenAI, Replit)</li>
              <li>Non garantiamo uptime del 100% ma lavoriamo per massimizzare la disponibilità</li>
              <li>Le interruzioni verranno comunicate quando possibile</li>
            </ul>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4">Modifiche ai Termini</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Ci riserviamo il diritto di modificare questi termini in qualsiasi momento. 
              Le modifiche saranno comunicate tramite:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>Aggiornamento della data di ultima modifica</li>
              <li>Notifica nell'applicazione per modifiche sostanziali</li>
              <li>Email agli utenti registrati quando disponibile</li>
            </ul>
            <p>
              L'uso continuato del servizio dopo le modifiche costituisce accettazione dei nuovi termini.
            </p>
          </div>
        </section>

        <Separator />

        <section>
          <h2 className="text-2xl font-semibold mb-4">Contatti e Supporto</h2>
          <div className="space-y-4 text-muted-foreground">
            <p>
              Per questioni legali, supporto tecnico o chiarimenti sui termini:
            </p>
            <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-lg space-y-2">
              <p><strong>Email Legale:</strong> legal@ai-product-generator.com</p>
              <p><strong>Supporto Tecnico:</strong> support@ai-product-generator.com</p>
              <p><strong>Sede Legale:</strong> Via della Tecnologia 123, 00100 Roma, Italia</p>
            </div>
          </div>
        </section>
      </Card>
    </div>
  );
}