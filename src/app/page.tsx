"use client";

import PluginCard from "@/showcase/PluginCard";
import { demos } from "@/showcase/demos";

const NPM_URL = "https://www.npmjs.com/package/@vecordis/lightweight-plugins";
const GITHUB_URL = "https://github.com/Effanuel/lightweight-plugins/tree/master/packages/lightweight-plugins";

export default function Home() {
  return (
    <main className="min-h-screen px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8 flex flex-col gap-3">
          <h1 className="break-all font-mono text-2xl font-bold">@vecordis/lightweight-plugins</h1>
          <p className="text-muted-foreground">
            {demos.length} plugins for TradingView Lightweight Charts v5: series primitives, a price-line tool and
            custom series.
          </p>
          <pre className="w-fit max-w-full overflow-x-auto rounded bg-black/40 px-3 py-2 text-sm">
            <code>pnpm add @vecordis/lightweight-plugins lightweight-charts</code>
          </pre>
          <nav className="flex gap-4 text-sm">
            <a href={NPM_URL} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
              npm
            </a>
            <a href={GITHUB_URL} target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">
              GitHub
            </a>
          </nav>
        </header>
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {demos.map((demo) => (
            <PluginCard key={demo.name} demo={demo} />
          ))}
        </section>
      </div>
    </main>
  );
}
