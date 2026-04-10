import { READER_RESOURCE_ASSETS } from './resourceConfig'

export const READER_CHROME = {
  assets: {
    noteBackground: {
      asset: READER_RESOURCE_ASSETS.noteBackground,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    },
    titleEmblem: {
      asset: READER_RESOURCE_ASSETS.titleEmblem,
      width: 124,
      height: 92,
      top: 18,
      right: 16,
      opacity: 0.3,
      backgroundSize: '100% 100%',
      backgroundPosition: 'center',
    },
    riteTitlePlate: {
      asset: READER_RESOURCE_ASSETS.riteTitlePlate,
    },
    riteTitleLine: {
      asset: READER_RESOURCE_ASSETS.riteTitleLine,
    },
    slotFrame: {
      asset: READER_RESOURCE_ASSETS.slotFrame,
      width: 82,
      minHeight: 132,
      backgroundSize: 'cover',
      backgroundPosition: 'center',
    },
    dialogueFrame: {
      asset: READER_RESOURCE_ASSETS.dialogueFrame,
      maxWidth: 520,
      minHeight: 120,
      padding: '18px 22px',
      backgroundSize: '100% 100%',
      backgroundPosition: 'center',
    },
  },
  header: {
    titleColor: '#fff6e6',
    subtitleColor: '#8c5727',
    metaColor: '#69411f',
    titleShadow: '0 2px 10px rgba(32, 18, 8, 0.22)',
    panelOverlay: 'linear-gradient(180deg, rgba(255, 246, 228, 0.9), rgba(225, 207, 170, 0.8))',
  },
  eventOverlay: {
    inset: 0,
    padding: 28,
    background: 'linear-gradient(180deg, rgba(14, 10, 7, 0.97), rgba(7, 6, 5, 0.99))',
    border: 'none',
    borderRadius: 0,
    backdropBlur: '14px',
  },
}
