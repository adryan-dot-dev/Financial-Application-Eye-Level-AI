import apiClient from './client'

export interface ExchangeRate {
  base: string
  rates: Record<string, number>
  date: string
}

export interface ConvertResult {
  from: string
  to: string
  amount: number
  result: number
  rate: number
}

export interface SupportedCurrency {
  code: string
  name: string
  symbol: string
}

// Raw shape returned by the backend (base_currency + Decimal-as-string rates)
interface RawExchangeRateResponse {
  base_currency: string
  rates: Record<string, number | string>
}

export const currencyApi = {
  /** Fetch exchange rates for a given base currency */
  rates: async (base = 'ILS'): Promise<ExchangeRate> => {
    const response = await apiClient.get<RawExchangeRateResponse>('/currency/rates', {
      params: { base },
    })
    const raw = response.data

    // Transform backend response to frontend ExchangeRate shape:
    // - base_currency → base
    // - Decimal strings → numbers
    // - date is not returned by backend, default to today
    const rates: Record<string, number> = {}
    for (const [code, value] of Object.entries(raw.rates)) {
      rates[code] = typeof value === 'string' ? parseFloat(value) : value
    }

    return {
      base: raw.base_currency,
      rates,
      date: new Date().toISOString().split('T')[0],
    }
  },

  /** Convert an amount from one currency to another */
  convert: async (
    from: string,
    to: string,
    amount: number,
  ): Promise<ConvertResult> => {
    const response = await apiClient.get<{
      from_currency: string
      to_currency: string
      original_amount: number | string
      converted_amount: number | string
      exchange_rate: number | string
    }>('/currency/convert', {
      params: { from, to, amount },
    })
    const raw = response.data
    return {
      from: raw.from_currency,
      to: raw.to_currency,
      amount: typeof raw.original_amount === 'string' ? parseFloat(raw.original_amount) : raw.original_amount,
      result: typeof raw.converted_amount === 'string' ? parseFloat(raw.converted_amount) : raw.converted_amount,
      rate: typeof raw.exchange_rate === 'string' ? parseFloat(raw.exchange_rate) : raw.exchange_rate,
    }
  },

  /** Get the list of supported currencies */
  supported: async (): Promise<SupportedCurrency[]> => {
    const response = await apiClient.get('/currency/supported')
    const data = response.data
    if (Array.isArray(data)) return data as SupportedCurrency[]
    if (data && Array.isArray(data.currencies)) return data.currencies as SupportedCurrency[]
    return []
  },
}
