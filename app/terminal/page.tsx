'use client'

import Link from 'next/link'
import { MonitorDown, Printer, ShieldCheck } from 'lucide-react'

export default function TerminalDownloadPage() {
    function tryOpenTerminal() {
        window.location.href = 'ordr-terminal://open'
    }

    return (
        <main className="min-h-dvh bg-background px-4 py-10 text-foreground">
            <section className="mx-auto flex max-w-4xl flex-col gap-6">
                <Link
                    href="/impressoras"
                    className="text-sm font-bold text-primary hover:underline"
                >
                    ← Voltar para Impressoras
                </Link>

                <div className="rounded-3xl border border-border bg-card p-6 shadow-xl">
                    <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
                        <div>
                            <p className="text-sm font-black uppercase tracking-[0.22em] text-primary">
                                ORDR Terminal
                            </p>

                            <h1 className="mt-2 text-3xl font-black">
                                Baixar terminal de impressão
                            </h1>

                            <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
                                O ORDR Terminal deve ser instalado no computador conectado às impressoras.
                                Ele recebe os pedidos criados no sistema online e imprime localmente.
                            </p>
                        </div>

                        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                            <Printer className="h-7 w-7" />
                        </div>
                    </div>

                    <div className="mt-6 grid gap-3 md:grid-cols-3">
                        <InfoCard
                            icon={<MonitorDown className="h-5 w-5" />}
                            title="Instale no caixa"
                            text="Use no computador que tem acesso às impressoras USB ou de rede."
                        />

                        <InfoCard
                            icon={<Printer className="h-5 w-5" />}
                            title="Vincule as ports"
                            text="Depois de abrir o terminal, escolha qual impressora atende cada port."
                        />

                        <InfoCard
                            icon={<ShieldCheck className="h-5 w-5" />}
                            title="Somente admin"
                            text="Apenas administradores da empresa podem registrar o terminal."
                        />
                    </div>

                    <div className="mt-7 rounded-2xl border border-border bg-background p-4">
                        <h2 className="text-lg font-black">Download</h2>

                        <p className="mt-1 text-sm text-muted-foreground">
                            Baixe e instale o ORDR Terminal neste computador.
                        </p>

                        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                            <a
                                href="https://panelordr.com.br/downloads/ORDR-Terminal-Setup.exe"
                                className="inline-flex h-11 items-center justify-center rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
                            >
                                Baixar para Windows
                            </a>

                            <button
                                type="button"
                                className="inline-flex h-11 items-center justify-center rounded-xl border border-border bg-card px-5 text-sm font-bold text-foreground transition hover:bg-muted"
                                onClick={tryOpenTerminal}
                            >
                                Tentar abrir novamente
                            </button>
                        </div>

                        <p className="mt-3 text-xs text-muted-foreground">
                            Depois de instalar, volte para Impressoras e clique em “Abrir ORDR Terminal”.
                        </p>
                    </div>
                </div>
            </section>
        </main>
    )
}

function InfoCard({
    icon,
    title,
    text,
}: {
    icon: React.ReactNode
    title: string
    text: string
}) {
    return (
        <div className="rounded-2xl border border-border bg-background p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {icon}
            </div>

            <h3 className="mt-3 text-sm font-black">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{text}</p>
        </div>
    )
}