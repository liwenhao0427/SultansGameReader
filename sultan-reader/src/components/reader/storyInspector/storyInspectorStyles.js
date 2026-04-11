import { READER_CHROME } from '../../../readerChromeConfig'

export const imageFallbackStyle = {
  color: 'rgba(241, 232, 213, 0.58)',
  fontSize: 14,
}

export const eventFallbackBoardStyle = {
  backgroundImage: 'linear-gradient(180deg, rgba(51, 39, 25, 0.92), rgba(17, 13, 10, 0.98))',
}

export const eventReaderShellStyle = {
  height: '100%',
  minHeight: 0,
}

export const eventBackdropShellStyle = {
  position: 'relative',
  height: '100%',
  minHeight: 0,
  borderRadius: 32,
  overflow: 'hidden',
  background: 'radial-gradient(circle at top, rgba(67, 48, 27, 0.28), rgba(8, 6, 5, 0.96))',
  border: '1px solid rgba(212, 184, 126, 0.12)',
}

export const eventBackdropEdgeStyle = {
  position: 'absolute',
  inset: 0,
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  opacity: 0.96,
}

export const eventBackdropHalfStyle = {
  backgroundRepeat: 'no-repeat',
  backgroundSize: '100% 100%',
  backgroundPosition: 'center',
}

export const eventBackdropCenterStyle = {
  position: 'relative',
  zIndex: 1,
  height: '100%',
  minHeight: 0,
  padding: '28px 30px',
}

export const eventReaderGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'minmax(0, 1fr) 320px',
  gap: 24,
  height: '100%',
  minHeight: 0,
}

export const eventBoardStageStyle = {
  minHeight: 0,
  display: 'grid',
  alignContent: 'start',
  gridTemplateRows: 'minmax(0, 1fr) auto',
  gap: 18,
  padding: '48px 0 28px 56px',
}

export const eventBoardContentStyle = {
  minHeight: 0,
  overflowY: 'auto',
  padding: '42px 56px 28px 28px',
  display: 'grid',
  alignContent: 'start',
  gap: 18,
}

export const eventReaderVisualStageStyle = {
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr) auto',
  gap: 10,
  alignItems: 'end',
}

export const eventVisualSpacerStyle = {
  minHeight: 0,
}

export const eventPortraitDockStyle = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'flex-end',
  minHeight: 420,
  paddingRight: 12,
}

export const eventFigureWrapStyle = {
  width: '100%',
  height: '100%',
  minHeight: 420,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'flex-end',
  overflow: 'hidden',
}

export const eventFigureImageStyle = {
  maxWidth: '120%',
  maxHeight: '96%',
  objectFit: 'contain',
  objectPosition: 'right bottom',
  filter: 'drop-shadow(0 24px 34px rgba(0, 0, 0, 0.34))',
}

export const eventFigureFallbackStyle = {
  color: '#cdb28a',
  fontSize: 16,
}

export const eventParagraphStyle = {
  padding: '0',
  borderRadius: 0,
  background: 'transparent',
  color: '#f4ead6',
  fontSize: 17,
  lineHeight: 2,
  whiteSpace: 'pre-wrap',
  textShadow: '0 1px 6px rgba(0, 0, 0, 0.24)',
}

export const eventChoicesWrapStyle = {
  display: 'grid',
  gap: 10,
  paddingRight: 56,
}

export const eventChoiceButtonStyle = {
  width: '100%',
  padding: '14px 18px',
  borderRadius: 14,
  border: '1px solid rgba(212, 184, 126, 0.2)',
  background: 'linear-gradient(180deg, rgba(52, 44, 30, 0.86), rgba(23, 18, 13, 0.94))',
  color: '#efe2c7',
  fontSize: 16,
  lineHeight: 1.6,
  textAlign: 'center',
  cursor: 'pointer',
  transition: 'all 160ms ease',
}

export const eventChoiceButtonActiveStyle = {
  border: '1px solid rgba(239, 215, 169, 0.52)',
  background: 'linear-gradient(180deg, rgba(95, 73, 43, 0.96), rgba(42, 31, 19, 0.96))',
  boxShadow: '0 10px 24px rgba(0, 0, 0, 0.22)',
}

export const eventActionRowStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  gap: 10,
}

export const eventResultBlockStyle = {
  display: 'grid',
  gap: 10,
  marginTop: 10,
}

export const eventTriggerShellStyle = {
  height: '100%',
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'stretch',
}

export const eventTriggerDetailStyle = {
  width: 'min(460px, 100%)',
  borderRadius: 28,
  border: '1px solid rgba(212, 184, 126, 0.14)',
  background: 'rgba(21, 16, 12, 0.94)',
  boxShadow: '0 24px 56px rgba(0, 0, 0, 0.28)',
  padding: '26px 24px',
  overflowY: 'auto',
}

export const eventTriggerMetaStyle = {
  padding: '10px 12px',
  borderRadius: 14,
  background: 'rgba(41, 31, 20, 0.82)',
  color: '#e5d2ae',
  fontSize: 13,
  lineHeight: 1.7,
}

export const storyHeaderShellStyle = {
  display: 'flex',
  justifyContent: 'stretch',
  minWidth: 0,
  width: '100%',
}

export const storyHeaderCardStyle = {
  width: '100%',
  padding: '12px 16px 10px',
  position: 'relative',
  overflow: 'hidden',
  borderRadius: 22,
  background: 'linear-gradient(180deg, rgba(250, 244, 231, 0.98), rgba(227, 212, 186, 0.95))',
  color: READER_CHROME.header.metaColor,
  border: '1px solid rgba(212, 184, 126, 0.14)',
  boxShadow: '0 10px 26px rgba(0, 0, 0, 0.18)',
}

export const storyMetaWrapStyle = {
  position: 'absolute',
  top: 10,
  right: 14,
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  gap: 8,
  maxWidth: '52%',
}

export const storyHeaderTitleRowStyle = {
  marginTop: 6,
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  paddingRight: 320,
}

export const storyHeaderActionsStyle = {
  position: 'absolute',
  top: 50,
  right: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  maxWidth: '45%',
}

export const conditionSummaryTextStyle = {
  display: 'inline-block',
  maxWidth: 240,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  verticalAlign: 'bottom',
}

export const storyHeaderTitleStyle = {
  fontSize: 22,
  fontWeight: 900,
  lineHeight: 1.18,
  color: '#3f2a16',
  letterSpacing: '0.01em',
}

export const sectionTitleStyle = {
  fontSize: 12,
  letterSpacing: '0.24em',
  textTransform: 'uppercase',
  color: '#d4b87e',
}

export const smallLineStyle = {
  fontSize: 13,
  lineHeight: 1.7,
  color: '#cbb391',
}

export const slotTagStyle = {
  padding: '2px 7px',
  borderRadius: 999,
  backgroundColor: 'rgba(212, 184, 126, 0.12)',
  border: '1px solid rgba(212, 184, 126, 0.14)',
  color: '#dcc9a6',
  fontSize: 10,
  lineHeight: 1.3,
}

export const slotTagButtonStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  padding: '2px 7px',
  borderRadius: 999,
  backgroundColor: 'rgba(212, 184, 126, 0.12)',
  border: '1px solid rgba(212, 184, 126, 0.14)',
  color: '#dcc9a6',
  fontSize: 10,
  lineHeight: 1.3,
  cursor: 'pointer',
}

export const metaChipCompactStyle = {
  padding: '4px 10px',
  borderRadius: 999,
  border: '1px solid rgba(92, 62, 31, 0.12)',
  backgroundColor: 'rgba(126, 93, 53, 0.12)',
  color: '#6a4623',
  fontSize: 11,
  lineHeight: 1.4,
}

export const effectChipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '5px 10px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.16)',
  background: 'rgba(45, 34, 23, 0.74)',
  color: '#ead7b2',
  fontSize: 12,
  lineHeight: 1.5,
}

export const effectCardLinkStyle = {
  padding: '2px 8px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.28)',
  background: 'rgba(212, 184, 126, 0.14)',
  color: '#ffefcc',
  fontSize: 12,
  lineHeight: 1.4,
  cursor: 'pointer',
}

export const segmentCardStyle = {
  padding: '18px 18px 16px',
  borderRadius: 24,
  border: '1px solid rgba(212, 184, 126, 0.12)',
  backgroundImage: 'linear-gradient(180deg, rgba(31, 24, 18, 0.96), rgba(20, 16, 12, 0.96))',
}

export const readerFilterInputStyle = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: 14,
  border: '1px solid rgba(212, 184, 126, 0.14)',
  background: 'rgba(212, 184, 126, 0.05)',
  color: '#f1e8d5',
  outline: 'none',
  fontSize: 13,
}

export const candidateStageStyle = {
  height: '100%',
  borderRadius: 32,
  border: '1px solid rgba(244, 232, 206, 0.2)',
  backgroundColor: 'rgba(16, 14, 11, 0.72)',
  boxShadow: '0 12px 26px rgba(0, 0, 0, 0.1)',
  padding: '20px 18px 18px',
  minHeight: 0,
  display: 'grid',
  gridTemplateRows: 'auto minmax(0, 1fr)',
  overflow: 'hidden',
}

export const emptyCandidateStyle = {
  marginTop: 16,
  borderRadius: 24,
  border: '1px dashed rgba(244, 232, 206, 0.18)',
  backgroundColor: 'rgba(22, 18, 14, 0.76)',
  padding: '22px 18px',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  textAlign: 'center',
}

export const primaryButtonStyle = {
  padding: '12px 18px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.24)',
  backgroundColor: 'rgba(212, 184, 126, 0.28)',
  color: '#fff1d4',
  cursor: 'pointer',
  fontSize: 14,
}

export const secondaryButtonStyle = {
  padding: '10px 16px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.18)',
  backgroundColor: 'rgba(22, 18, 14, 0.82)',
  color: '#f3ead8',
  cursor: 'pointer',
}

export const activeToggleButtonStyle = {
  ...secondaryButtonStyle,
  border: '1px solid rgba(143, 191, 119, 0.28)',
  backgroundColor: 'rgba(143, 191, 119, 0.14)',
  color: '#e4f1d7',
}

export const choiceButtonStyle = {
  padding: '9px 14px',
  borderRadius: 999,
  border: '1px solid rgba(212, 184, 126, 0.24)',
  backgroundColor: 'rgba(212, 184, 126, 0.08)',
  color: '#f2ead5',
  cursor: 'pointer',
}

export const actionButtonStyle = {
  padding: '10px 14px',
  borderRadius: 999,
  border: '1px solid rgba(143, 191, 119, 0.24)',
  backgroundColor: 'rgba(83, 116, 70, 0.72)',
  color: '#e5f1d9',
  cursor: 'pointer',
}

export const ritePreparationPanelStyle = {
  borderRadius: 32,
  border: '1px solid rgba(244, 232, 206, 0.2)',
  backgroundColor: 'rgba(20, 16, 12, 0.78)',
  boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)',
  padding: '20px 18px',
  display: 'grid',
  gap: 16,
  overflow: 'hidden',
}

export const riteSlotScrollerStyle = {
  display: 'flex',
  gap: 14,
  overflowX: 'auto',
  overflowY: 'hidden',
  paddingBottom: 8,
  alignItems: 'flex-start',
}

export const riteCandidateGridStyle = {
  display: 'flex',
  gap: 6,
  overflow: 'hidden',
  alignItems: 'stretch',
}

export const ritePreparationInfoPanelStyle = {
  height: '100%',
  minHeight: 0,
  borderRadius: 32,
  border: '1px solid rgba(244, 232, 206, 0.2)',
  boxShadow: '0 16px 34px rgba(0, 0, 0, 0.18)',
  backgroundColor: 'rgba(22, 17, 13, 0.78)',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
}

export const ritePreparationFooterStyle = {
  padding: '16px 24px 24px',
  borderTop: '1px solid rgba(212, 184, 126, 0.12)',
  display: 'flex',
  gap: 12,
  flexWrap: 'wrap',
  alignItems: 'center',
}

export const translucentTextBlockStyle = {
  marginTop: 10,
  padding: '14px 16px',
  borderRadius: 18,
  background: 'rgba(12, 10, 8, 0.58)',
  border: '1px solid rgba(244, 232, 206, 0.12)',
  color: '#f2ead7',
  fontSize: 14,
  lineHeight: 1.8,
  whiteSpace: 'pre-wrap',
}

export const candidateToolbarStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  justifyItems: 'end',
  alignItems: 'flex-end',
}

export const candidateToolbarGroupStyle = {
  display: 'flex',
  flexWrap: 'wrap',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: 8,
}

export const candidateSearchInputStyle = {
  ...readerFilterInputStyle,
  width: 'min(220px, 100%)',
}

export const riteHiddenBackdropStyle = {
  height: '100%',
  minHeight: 0,
  gridColumn: '1 / -1',
  borderRadius: 32,
  background: 'transparent',
}

export const branchSuccessButtonStyle = {
  padding: '10px 14px',
  borderRadius: 999,
  border: '1px solid rgba(143, 191, 119, 0.24)',
  backgroundColor: 'rgba(143, 191, 119, 0.12)',
  color: '#e5f1d9',
  cursor: 'pointer',
}

export const branchFailedButtonStyle = {
  padding: '10px 14px',
  borderRadius: 999,
  border: '1px solid rgba(195, 91, 91, 0.24)',
  backgroundColor: 'rgba(195, 91, 91, 0.12)',
  color: '#f6d1d1',
  cursor: 'pointer',
}

export const overlayShellStyle = {
  position: 'fixed',
  inset: 0,
  backgroundColor: 'rgba(5, 4, 3, 0.8)',
  zIndex: 90,
  backdropFilter: `blur(${READER_CHROME.eventOverlay.backdropBlur})`,
}

export const overlayCardStyle = {
  position: 'fixed',
  inset: 0,
  display: 'grid',
  gridTemplateRows: 'auto 1fr',
  backgroundImage: READER_CHROME.eventOverlay.background,
}

export const overlayHeaderStyle = {
  padding: '16px 24px 12px',
  borderBottom: '1px solid rgba(212, 184, 126, 0.12)',
}

export const overlayHeaderLeftStyle = {
  width: '100%',
}

export const closeButtonStyle = {
  padding: '10px 16px',
  borderRadius: 999,
  border: '1px solid rgba(143, 80, 80, 0.34)',
  backgroundColor: 'rgba(133, 85, 62, 0.92)',
  color: '#fff3de',
  cursor: 'pointer',
  fontWeight: 800,
  boxShadow: '0 8px 18px rgba(77, 35, 25, 0.18)',
}

export const selectionOverlayStyle = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(7, 6, 5, 0.72)',
  backdropFilter: 'blur(8px)',
  zIndex: 95,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24,
}

export const selectionDialogStyle = {
  width: 'min(720px, 100%)',
  maxHeight: 'min(78vh, 760px)',
  borderRadius: 28,
  overflow: 'hidden',
  border: '1px solid rgba(212, 184, 126, 0.18)',
  background: 'linear-gradient(180deg, rgba(39, 28, 18, 0.98), rgba(18, 13, 10, 0.98))',
  boxShadow: '0 36px 82px rgba(0, 0, 0, 0.34)',
  display: 'flex',
  flexDirection: 'column',
}

export const selectionDialogHeaderStyle = {
  padding: '22px 24px 18px',
  borderBottom: '1px solid rgba(212, 184, 126, 0.12)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: 16,
}

export const selectionDialogSearchWrapStyle = {
  padding: '16px 20px 0',
}

export const selectionDialogBodyStyle = {
  padding: 20,
  overflowY: 'auto',
  display: 'grid',
  gap: 12,
}

export const selectionDialogEmptyStyle = {
  padding: '18px 16px',
  borderRadius: 18,
  border: '1px solid rgba(212, 184, 126, 0.14)',
  background: 'rgba(22, 18, 14, 0.94)',
  color: '#cbb391',
  textAlign: 'center',
}

export const selectionDialogItemStyle = {
  width: '100%',
  textAlign: 'left',
  padding: '14px 16px',
  borderRadius: 18,
  border: '1px solid rgba(212, 184, 126, 0.14)',
  background: 'rgba(22, 18, 14, 0.94)',
  color: '#f1e8d5',
  cursor: 'pointer',
}

export const selectionDialogItemActiveStyle = {
  ...selectionDialogItemStyle,
  border: '1px solid rgba(143, 191, 119, 0.36)',
  background: 'rgba(83, 116, 70, 0.22)',
  color: '#f4f0de',
}

export const selectionDialogItemTitleStyle = {
  fontSize: 15,
  lineHeight: 1.8,
  color: 'inherit',
  whiteSpace: 'pre-wrap',
}

export const selectionDialogItemMetaStyle = {
  marginTop: 8,
  fontSize: 12,
  color: '#cbb391',
}

