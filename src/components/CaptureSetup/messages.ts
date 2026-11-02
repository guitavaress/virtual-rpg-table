import type { CaptureError, SourceKind } from '../../features/capture/types'

export const CAMERA_BUSY_MESSAGE =
  'A câmera está em uso por outro programa. No Windows, programas diferentes não compartilham a webcam: abra este app no MESMO navegador (mesmo perfil) em que o Meet está aberto, em outra aba, ou feche o outro programa que usa a câmera.'

export function describeCaptureError(kind: SourceKind, error: CaptureError): string {
  if (kind === 'file' && error.code === 'unsupported') {
    return 'Esse arquivo não parece ser um vídeo. Escolha um arquivo de vídeo (por exemplo .mp4 ou .webm).'
  }
  if (kind === 'synthetic' && error.code === 'unsupported') {
    return 'Este navegador não consegue gerar a fonte sintética. Use Chrome ou Edge atualizados.'
  }
  if (kind === 'camera') {
    switch (error.code) {
      case 'denied-or-cancelled':
        return 'A permissão da câmera foi negada. Libere a câmera no ícone de cadeado da barra de endereço e tente de novo.'
      case 'source-busy':
        return CAMERA_BUSY_MESSAGE
      case 'overconstrained':
        return 'A câmera escolhida não atende à qualidade pedida ou não está mais disponível. Escolha outra câmera ou a qualidade 720p.'
      case 'source-unavailable':
        return 'Nenhuma câmera encontrada (ou ela foi desconectada). Conecte uma câmera e tente de novo.'
      case 'unsupported':
        return 'Este navegador ou endereço não permite acessar a câmera. Use Chrome ou Edge no computador, em localhost ou HTTPS.'
      default:
        break
    }
  }
  switch (error.code) {
    case 'denied-or-cancelled':
      return 'A seleção foi cancelada ou a permissão foi negada. Nada foi capturado. Clique em “Selecionar fonte de vídeo” para tentar de novo.'
    case 'no-user-gesture':
      return 'O navegador só abre o seletor a partir de um clique direto. Tente de novo pelo botão.'
    case 'unsupported':
      return 'Este navegador ou endereço não permite captura de aba/janela. Use Chrome ou Edge no computador, em localhost ou HTTPS.'
    case 'source-busy':
    case 'overconstrained':
    case 'source-unavailable':
      return 'Não foi possível ler a fonte escolhida (pode ter sido fechada ou bloqueada pelo sistema). Escolha outra aba ou janela.'
    case 'unknown':
      return 'Erro inesperado ao iniciar a captura.'
  }
}

export const ENDED_MESSAGE =
  'O compartilhamento foi encerrado (pelo botão do navegador ou porque a aba/janela fechou). A região calibrada foi mantida: selecione a fonte de novo para continuar.'
