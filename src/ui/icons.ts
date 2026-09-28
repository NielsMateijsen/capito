// Phosphor icons, one file per icon (…/dist/csr/<Name>) so dev builds stay fast. Components import
// icons only from here. Default weight: fill (see ICON); a button with only an icon needs an aria-label.
export { XIcon as IconClose } from '@phosphor-icons/react/dist/csr/X'
export { LightbulbIcon as IconHint } from '@phosphor-icons/react/dist/csr/Lightbulb'
export { SpeakerHighIcon as IconAudio } from '@phosphor-icons/react/dist/csr/SpeakerHigh'
export { FlagIcon as IconReport } from '@phosphor-icons/react/dist/csr/Flag'
export { GearIcon as IconSettings } from '@phosphor-icons/react/dist/csr/Gear'
export { ArrowLeftIcon as IconBack } from '@phosphor-icons/react/dist/csr/ArrowLeft'
export { ArrowRightIcon as IconNext } from '@phosphor-icons/react/dist/csr/ArrowRight'
export { CheckIcon as IconCheck } from '@phosphor-icons/react/dist/csr/Check'
export { CheckCircleIcon as IconCorrect } from '@phosphor-icons/react/dist/csr/CheckCircle'
export { WarningCircleIcon as IconAlmost } from '@phosphor-icons/react/dist/csr/WarningCircle'
export { XCircleIcon as IconWrong } from '@phosphor-icons/react/dist/csr/XCircle'
export { FireIcon as IconStreak } from '@phosphor-icons/react/dist/csr/Fire'
export { LockIcon as IconLocked } from '@phosphor-icons/react/dist/csr/Lock'
export { TrophyIcon as IconExam } from '@phosphor-icons/react/dist/csr/Trophy'
export { PlayIcon as IconStart } from '@phosphor-icons/react/dist/csr/Play'
export { ArrowsClockwiseIcon as IconRefresh } from '@phosphor-icons/react/dist/csr/ArrowsClockwise'
export { CaretRightIcon as IconOpen } from '@phosphor-icons/react/dist/csr/CaretRight'
export { StarIcon as IconPerfect } from '@phosphor-icons/react/dist/csr/Star'
export { FlagCheckeredIcon as IconFinal } from '@phosphor-icons/react/dist/csr/FlagCheckered'
export { InfoIcon as IconInfo } from '@phosphor-icons/react/dist/csr/Info'
export { DownloadSimpleIcon as IconDownload } from '@phosphor-icons/react/dist/csr/DownloadSimple'

/** Shared icon props: every icon inherits the text colour and scales with the token size. */
export const ICON = { weight: 'fill', size: '1em', 'aria-hidden': true } as const

/** For line icons (close, arrows): the fill weight of these draws a frame around them. */
export const ICON_LINE = { ...ICON, weight: 'bold' } as const
