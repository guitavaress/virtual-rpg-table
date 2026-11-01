import type { CaptureError, SourceKind } from '../../features/capture/types'

export function describeCaptureError(kind: SourceKind, error: CaptureError): string {
  if (kind === 'file' && error.code === 'unsupported') {
    return 'Esse arquivo não parece ser um vídeo. Escolha um arquivo de vídeo (por exemplo .mp4 ou .webm).'
  }
  if (kind === 'synthetic' && error.code === 'unsupported') {
    return 'Este navegador não consegue gerar a fonte sintética. Use Chrome ou Edge atualizados.'
  }
  switch (error.code) {
    case 'denied-or-cancelled':
      return 'A seleção foi cancelada ou a permissão foi negada. Nada foi capturado. Clique em “Selecionar fonte de vídeo” para tentar de novo.'
    case 'no-user-gesture':
      return 'O navegador só abre o seletor a partir de um clique direto. Tente de novo pelo botão.'
    case 'unsupported':
      return 'Este navegador ou endereço não permite captura de aba/janela. Use Chrome ou Edge no computador, em localhost ou HTTPS.'
    case 'source-unavailable':
      return 'Não foi possível ler a fonte escolhida (pode ter sido fechada ou bloqueada pelo sistema). Escolha outra aba ou janela.'
    case 'unknown':
      return 'Erro inesperado ao iniciar a captura.'
  }
}

export const ENDED_MESSAGE =
  'O compartilhamento foi encerrado (pelo botão do navegador ou porque a aba/janela fechou). A região calibrada foi mantida: selecione a fonte de novo para continuar.'
