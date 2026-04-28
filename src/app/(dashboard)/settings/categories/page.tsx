import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CATEGORY_LABELS, CATEGORY_COLORS, INCOME_CATEGORIES, EXPENSE_CATEGORIES } from '@/types'

export default function CategoriesPage() {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-slate-800">Categorias</h2>
        <p className="text-sm text-slate-500">Categorias disponíveis para classificar suas transações</p>
      </div>

      <Card className="border border-slate-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-emerald-700">Receitas</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {INCOME_CATEGORIES.map((cat) => (
              <div
                key={cat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-50 border border-slate-100 text-slate-700"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                />
                {cat === 'custom' ? 'Personalizada' : CATEGORY_LABELS[cat]}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-slate-100 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold text-red-500">Despesas</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="flex flex-wrap gap-2">
            {EXPENSE_CATEGORIES.map((cat) => (
              <div
                key={cat}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-slate-50 border border-slate-100 text-slate-700"
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: CATEGORY_COLORS[cat] }}
                />
                {cat === 'custom' ? 'Personalizada' : CATEGORY_LABELS[cat]}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="border border-dashed border-slate-200 shadow-none bg-slate-50/50">
        <CardContent className="py-4 px-4">
          <p className="text-xs text-slate-500">
            A categoria <strong>Personalizada</strong> permite criar um nome livre ao lançar uma transação.
            Cada transação pode ter seu próprio nome de categoria personalizada.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
