import { FolderOpen, Plus, Weight } from 'lucide-react'
import { useNavigate } from 'react-router'
import { CALCULATORS } from '@/calculators/registry'
import { TonnaLogo } from '@/components/layout/TonnaLogo'
import { Button, ButtonLink } from '@/components/ui/Button'
import { T } from '@/i18n'
import { useEstimates } from '@/store/estimates'
import { useSettings } from '@/store/settings'

const LOGO_MASK = `url(${import.meta.env.BASE_URL}brand/tonna-logo-white.svg)`

/** Glowing logo: halo behind, breathing light around the shape and a sheen passing over it. */
function GlowLogo({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none relative aspect-[1030/1208] ${className}`} aria-hidden>
      <div className="animate-halo motion-safe-anim absolute -inset-[30%] rounded-full bg-[radial-gradient(closest-side,rgb(249_115_22/0.28),rgb(255_255_255/0.08)_45%,transparent_75%)] blur-2xl" />
      <TonnaLogo className="animate-logo-glow motion-safe-anim relative h-full w-full text-white" />
      <div className="absolute inset-0 overflow-hidden" style={{ maskImage: LOGO_MASK, WebkitMaskImage: LOGO_MASK, maskSize: '100% 100%', WebkitMaskSize: '100% 100%' }}>
        <div className="animate-sheen motion-safe-anim absolute inset-y-0 -left-1/2 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent" />
      </div>
    </div>
  )
}

export function Hero() {
  const create = useEstimates((s) => s.create)
  const defaults = useSettings((s) => s.estimateDefaults)
  const navigate = useNavigate()
  return (
    // The hero is always dark so the logo light reads well in both themes.
    <section className="dark relative overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 text-white shadow-2xl shadow-zinc-950/20">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_85%_40%,rgb(63_63_70/0.55),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.07] [background-image:linear-gradient(rgb(255_255_255)_1px,transparent_1px),linear-gradient(90deg,rgb(255_255_255)_1px,transparent_1px)] [background-size:44px_44px] [mask-image:radial-gradient(ellipse_at_80%_50%,black,transparent_70%)]" />
      <div className="animate-glow pointer-events-none absolute -right-16 -bottom-24 h-72 w-72 rounded-full bg-accent-500/20 blur-3xl" />

      <div className="relative grid items-center gap-6 px-6 py-8 sm:px-10 sm:py-10 md:grid-cols-[minmax(0,1fr)_auto]">
        <div className="stagger max-w-2xl">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-medium text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-accent-500 shadow-[0_0_8px_2px_rgb(249_115_22/0.6)]" />
            {T('Тоннаж · сметы · документы')}
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">{T('Расчёты материалов, тоннаж и сметы — в одном месте')}</h1>
          <p className="mt-3 text-base text-zinc-400 sm:text-lg">
            {CALCULATORS.length} {T('строительных калькуляторов, спецификация металла по ГОСТ, сметы с НДС, накладными и выгрузкой в Excel. Загрузите архив с проектной документацией — сайт распакует его и найдёт сметы и спецификации.')}
          </p>
          <div className="mt-6 flex flex-wrap gap-3" data-tour="hero-actions">
            <ButtonLink to="/docs" variant="primary" className="!bg-white !text-zinc-900 shadow-[0_0_24px_rgb(255_255_255/0.18)] hover:!bg-zinc-200"><FolderOpen size={17} /> {T('Загрузить документы')}</ButtonLink>
            <Button className="!border-white/15 !bg-white/5 !text-white hover:!bg-white/10" onClick={() => navigate(`/estimates/${create(T('Новая смета'), defaults)}`)}>
              <Plus size={17} /> {T('Новая смета')}
            </Button>
            <ButtonLink to="/calc/metal" className="!border-white/15 !bg-white/5 !text-white hover:!bg-white/10"><Weight size={17} /> {T('Тоннаж металла')}</ButtonLink>
          </div>
        </div>
        <div className="hidden justify-center px-6 md:flex">
          <GlowLogo className="h-56 lg:h-64" />
        </div>
      </div>
      {/* On phones the mark sits behind the text as a soft watermark. */}
      <div className="pointer-events-none absolute -right-10 -bottom-8 opacity-25 md:hidden">
        <GlowLogo className="h-44" />
      </div>
    </section>
  )
}
