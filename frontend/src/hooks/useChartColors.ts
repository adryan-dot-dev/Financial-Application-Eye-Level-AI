import { useTheme } from '@/contexts/ThemeContext'

/**
 * Returns theme-aware semantic chart colors for use in Recharts components.
 *
 * Main stroke/fill colors delegate to CSS custom properties (var(--color-*))
 * which are already theme-aware. This hook provides the derived rgba values
 * needed for drop-shadow filters on activeDot — those cannot reference CSS
 * variables directly because they live inside a filter string.
 *
 * Light mode: slightly more saturated tones with moderate opacity glow.
 * Dark mode: brighter/lighter tones with higher opacity for better contrast
 *            on dark backgrounds.
 */
export function useChartColors() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'

  return {
    /** Income / success — green */
    incomeGlow: isDark
      ? 'rgba(57, 230, 176, 0.5)'   // #39E6B0 dark-mode income, brighter
      : 'rgba(5, 205, 153, 0.4)',    // #05CD99 light-mode income

    /** Expense / danger — red/coral */
    expenseGlow: isDark
      ? 'rgba(249, 140, 131, 0.5)'  // #F98C83 dark-mode danger, brighter
      : 'rgba(238, 93, 80, 0.4)',   // #EE5D50 light-mode danger

    /** Balance / brand — indigo/purple */
    balanceGlow: isDark
      ? 'rgba(134, 140, 255, 0.5)'  // #868CFF dark-mode brand, brighter
      : 'rgba(108, 99, 255, 0.4)',  // mid-brand purple, light-mode

    /** Forecast / blue */
    forecastGlow: isDark
      ? 'rgba(96, 165, 250, 0.5)'   // #60A5FA bright blue
      : 'rgba(59, 130, 246, 0.4)',  // #3B82F6 standard blue

    /** Warning / amber */
    warningGlow: isDark
      ? 'rgba(255, 201, 117, 0.5)'  // #FFC975 dark-mode warning
      : 'rgba(255, 181, 71, 0.4)',  // #FFB547 light-mode warning

    /** Neutral / gray */
    neutralGlow: isDark
      ? 'rgba(143, 155, 186, 0.4)'  // #8F9BBA
      : 'rgba(163, 174, 208, 0.4)', // #A3AED0
  }
}
