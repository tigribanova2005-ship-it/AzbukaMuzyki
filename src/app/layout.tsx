import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Азбука Музыки',
  description: 'Семейный музыкальный клуб',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru">
      <body style={{ margin: 0, padding: 0 }}>{children}</body>
    </html>
  )
}
