import { Logo } from "./logo";

export function Header() {
  return (
    <header className="border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          <Logo size="md" />

          <div className="text-sm text-muted-foreground">
            Powered by{" "}
            <a
              href="https://openai.com/index/gpt-4v-system-card/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium transition-colors duration-150"
            >
              GPT-4V(ision)
            </a>
          </div>
        </div>
      </div>
    </header>
  );
}
