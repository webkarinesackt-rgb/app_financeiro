/**
 * Gerenciamento de etapas de produção de projetos.
 *
 * Por que não uma coluna nova: a tabela `projects` já tem uma coluna
 * `status` usada pelos Fechamentos (closed/in_production/delivered/paid/
 * cancelled) — não queremos quebrar esse domínio. Em vez disso, gravamos
 * a etapa de produção como um marcador no campo `notes`:
 *
 *     [stage:design_pagina]
 *     [fysi:<clientId>]                  ← marcador do briefing_app
 *     Origem: briefing_app
 *     ...
 *
 * Os marcadores ficam SEMPRE no topo, antes do conteúdo livre. Helpers
 * abaixo fazem parse/replace preservando o resto do conteúdo.
 */

export interface StageDef {
  id: string
  label: string
  /** Cor base (Tailwind) usada em badges, fundos de coluna, etc. */
  tone:
    | 'slate'
    | 'indigo'
    | 'pink'
    | 'violet'
    | 'rose'
    | 'amber'
    | 'red'
    | 'orange'
    | 'emerald'
}

export const STAGES: StageDef[] = [
  { id: 'a_iniciar',               label: 'A INICIAR',               tone: 'slate'   },
  { id: 'onboarding',              label: 'ONBOARDING',              tone: 'indigo'  },
  { id: 'redacao_copy',            label: 'REDAÇÃO/COPY',            tone: 'pink'    },
  { id: 'design_pagina',           label: 'DESIGN DA PÁGINA',        tone: 'violet'  },
  { id: 'validacao_design_copy',   label: 'VALIDAÇÃO DESIGN+COPY',   tone: 'rose'    },
  { id: 'ajustes_design_copy',     label: 'AJUSTES DESIGN/COPY',     tone: 'amber'   },
  { id: 'implementacao',           label: 'IMPLEMENTAÇÃO',           tone: 'red'     },
  { id: 'validacao_implementacao', label: 'VALIDAÇÃO IMPLEMENTAÇÃO', tone: 'orange'  },
  { id: 'ajuste_implementacao',    label: 'AJUSTE IMPLEMENTAÇÃO',    tone: 'pink'    },
  { id: 'otimizacao_entrega',      label: 'OTIMIZAÇÃO+ENTREGA',      tone: 'orange'  },
  { id: 'completo_entregue',       label: 'COMPLETO|ENTREGUE',       tone: 'emerald' },
]

export const STAGE_IDS = STAGES.map((s) => s.id)
export const STAGE_BY_ID: Record<string, StageDef> = Object.fromEntries(
  STAGES.map((s) => [s.id, s]),
)

const STAGE_MARKER_RE = /\[stage:([a-z_]+)\]/i

export function parseStage(notes: string | null | undefined): string {
  if (!notes) return 'a_iniciar'
  const m = notes.match(STAGE_MARKER_RE)
  if (m && STAGE_BY_ID[m[1]]) return m[1]
  return 'a_iniciar'
}

/**
 * Insere ou substitui o marcador [stage:<id>] em notes.
 * Mantém todo o resto do conteúdo intocado.
 */
export function withStage(notes: string | null | undefined, stageId: string): string {
  const safe = STAGE_BY_ID[stageId] ? stageId : 'a_iniciar'
  const marker = `[stage:${safe}]`
  if (!notes) return marker
  if (STAGE_MARKER_RE.test(notes)) {
    return notes.replace(STAGE_MARKER_RE, marker)
  }
  // Sem marcador ainda — coloca como primeira linha.
  return `${marker}\n${notes}`
}

/**
 * Cor Tailwind por tom — usado nos componentes da UI.
 * (Repetido aqui pra ficar local ao arquivo de domínio.)
 */
export const STAGE_TONE_CLASSES: Record<StageDef['tone'], {
  bg: string
  border: string
  text: string
  dot: string
}> = {
  slate:   { bg: 'bg-slate-50',    border: 'border-slate-200',    text: 'text-slate-700',    dot: 'bg-slate-500'    },
  indigo:  { bg: 'bg-indigo-50',   border: 'border-indigo-200',   text: 'text-indigo-700',   dot: 'bg-indigo-500'   },
  pink:    { bg: 'bg-pink-50',     border: 'border-pink-200',     text: 'text-pink-700',     dot: 'bg-pink-500'     },
  violet:  { bg: 'bg-violet-50',   border: 'border-violet-200',   text: 'text-violet-700',   dot: 'bg-violet-500'   },
  rose:    { bg: 'bg-rose-50',     border: 'border-rose-200',     text: 'text-rose-700',     dot: 'bg-rose-500'     },
  amber:   { bg: 'bg-amber-50',    border: 'border-amber-200',    text: 'text-amber-700',    dot: 'bg-amber-500'    },
  red:     { bg: 'bg-red-50',      border: 'border-red-200',      text: 'text-red-700',      dot: 'bg-red-500'      },
  orange:  { bg: 'bg-orange-50',   border: 'border-orange-200',   text: 'text-orange-700',   dot: 'bg-orange-500'   },
  emerald: { bg: 'bg-emerald-50',  border: 'border-emerald-200',  text: 'text-emerald-700',  dot: 'bg-emerald-500'  },
}
