import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Você é um assistente especializado em analisar extratos bancários e de cartão de crédito brasileiros.

O usuário vai colar o texto de um extrato (copiado do aplicativo do banco, PDF, ou digitado).

Sua tarefa é extrair TODAS as transações presentes no extrato e retornar um JSON com o seguinte formato:

{
  "transactions": [
    {
      "type": "income" | "expense",
      "amount": number (valor positivo, ex: 150.00),
      "description": "string (descrição da transação)",
      "date": "YYYY-MM-DD",
      "category": "string (uma das categorias abaixo)",
      "payment_method": "string (um dos métodos abaixo)"
    }
  ]
}

Categorias disponíveis para receitas: salary, freelance, project, consulting, commission, bonus, rental, digital_products, investment, gift, refund, other
Categorias disponíveis para despesas: food, transport, housing, health, education, entertainment, clothing, utilities, subscriptions, insurance, taxes, other

Métodos de pagamento: pix, debit, credit, cash, transfer, boleto, other

Regras:
1. Sempre retorne JSON válido, nunca texto livre.
2. Valores nunca negativos no campo "amount".
3. Para entradas/créditos: type = "income". Para saídas/débitos: type = "expense".
4. Se a data não estiver clara, use a data mais recente disponível no extrato.
5. Infira a categoria com base na descrição (ex: "iFood" → food, "Uber" → transport).
6. Para Pix recebidos: type = "income", payment_method = "pix".
7. Para Pix enviados: type = "expense", payment_method = "pix".
8. Se não conseguir identificar algum campo, use "other" para categoria e "pix" para método.
9. Retorne APENAS o JSON, sem explicações.`

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY não configurada' }, { status: 500 })
  }

  const { statement } = await req.json()
  if (!statement?.trim()) {
    return NextResponse.json({ error: 'Extrato vazio' }, { status: 400 })
  }

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: [
        {
          type: 'text',
          text: SYSTEM_PROMPT,
          cache_control: { type: 'ephemeral' },
        },
      ],
      messages: [
        {
          role: 'user',
          content: `Analise o seguinte extrato e extraia todas as transações:\n\n${statement}`,
        },
      ],
    })

    const responseText = message.content[0].type === 'text' ? message.content[0].text : ''
    const jsonMatch = responseText.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ error: 'Resposta inválida da IA' }, { status: 500 })
    }

    const parsed = JSON.parse(jsonMatch[0])
    return NextResponse.json(parsed)
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'message' in err
      ? String((err as { message: unknown }).message)
      : 'Erro ao processar extrato'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
