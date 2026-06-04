import { redirect } from 'next/navigation';

/**
 * Raiz do app → manda direto pro TOTEM (a tela principal do aparelho).
 * Sem isto, abrir `localhost:3000` (sem caminho) caía no 404 BRANCO padrão do
 * Next — que parecia "o totem não está dark". Agora a raiz nunca aparece: vai
 * reto pra tela do operário (dark).
 */
export default function Home() {
  redirect('/totem');
}
