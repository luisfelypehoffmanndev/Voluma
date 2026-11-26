import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';

import { colors } from '@/theme/tokens';

/**
 * Icones do app: Ionicons, monocromaticos (Design/design.md, linguagem Blink).
 *
 * Contorno por padrao; `filled` troca pela versao preenchida, que e o estado
 * ATIVO (a aba aberta). Os nomes exportados sao os mesmos da versao desenhada a
 * mao que existia antes, para nenhum chamador precisar mudar.
 */
export type IconProps = {
  size?: number;
  /** Aceita `ColorValue` para receber direto o `color` que a tab bar entrega. */
  color?: ColorValue;
  /** Mantido por compatibilidade com os desenhos antigos; o Ionicons ignora. */
  strokeWidth?: number;
  filled?: boolean;
};

type Name = React.ComponentProps<typeof Ionicons>['name'];

function icon(outline: Name, solid: Name = outline) {
  return function Icon({ size = 22, color = colors.textPrimary, filled = false }: IconProps) {
    return <Ionicons name={filled ? solid : outline} size={size} color={color as string} />;
  };
}

export const ChartIcon = icon('stats-chart-outline', 'stats-chart');
export const PlusIcon = icon('add');
export const MinusIcon = icon('remove');
export const CheckIcon = icon('checkmark');
export const ChevronRightIcon = icon('chevron-forward');
export const ChevronLeftIcon = icon('chevron-back');
export const ArrowLeftIcon = icon('arrow-back');
export const TrashIcon = icon('trash-outline', 'trash');
export const AlertIcon = icon('alert-circle-outline', 'alert-circle');
export const MoreIcon = icon('ellipsis-horizontal');
export const CloseIcon = icon('close');
export const PlayIcon = icon('play-outline', 'play');
export const TodayIcon = icon('today-outline', 'today');
export const ListIcon = icon('list-outline', 'list');
export const PersonIcon = icon('person-outline', 'person');
export const GoogleIcon = icon('logo-google');
export const SyncIcon = icon('sync-outline', 'sync');
export const BarbellIcon = icon('barbell-outline', 'barbell');
export const CalendarIcon = icon('calendar-outline', 'calendar');
export const BodyIcon = icon('body-outline', 'body');
export const PhoneIcon = icon('phone-portrait-outline', 'phone-portrait');
export const CloudIcon = icon('cloud-outline', 'cloud');
export const InfoIcon = icon('information-circle-outline', 'information-circle');
export const PeopleIcon = icon('people-outline', 'people');
export const ImageIcon = icon('image-outline', 'image');
export const ShareIcon = icon('share-social-outline', 'share-social');
