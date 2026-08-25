/**
 * GERADO por scripts/vendor-movement-art.mjs — nao editar a mao.
 *
 * Arte de Bryl Lim (https://bryllim.com), do projeto workout-guide, derivada de
 * Everkinetic. Licenca CC BY-SA 4.0 —
 * https://creativecommons.org/licenses/by-sa/4.0/
 *
 * Alteracoes: extraido o atributo `d` do path unico de cada SVG e arredondadas
 * as coordenadas para 1 casa decimal. Ver ATTRIBUTION.md.
 */

import { frames as arnoldPress, viewBox as arnoldPressBox } from './arnold-press';
import { frames as barbellRow, viewBox as barbellRowBox } from './barbell-row';
import { frames as benchDip, viewBox as benchDipBox } from './bench-dip';
import { frames as benchPress, viewBox as benchPressBox } from './bench-press';
import { frames as bicepCurl, viewBox as bicepCurlBox } from './bicep-curl';
import { frames as bulgarianSplitSquat, viewBox as bulgarianSplitSquatBox } from './bulgarian-split-squat';
import { frames as cableCrunch, viewBox as cableCrunchBox } from './cable-crunch';
import { frames as cableCurl, viewBox as cableCurlBox } from './cable-curl';
import { frames as cableFly, viewBox as cableFlyBox } from './cable-fly';
import { frames as cableKickback, viewBox as cableKickbackBox } from './cable-kickback';
import { frames as chestDip, viewBox as chestDipBox } from './chest-dip';
import { frames as concentrationCurl, viewBox as concentrationCurlBox } from './concentration-curl';
import { frames as crunch, viewBox as crunchBox } from './crunch';
import { frames as deadlift, viewBox as deadliftBox } from './deadlift';
import { frames as declineBenchPress, viewBox as declineBenchPressBox } from './decline-bench-press';
import { frames as dumbbellBenchPress, viewBox as dumbbellBenchPressBox } from './dumbbell-bench-press';
import { frames as dumbbellFly, viewBox as dumbbellFlyBox } from './dumbbell-fly';
import { frames as ezBarCurl, viewBox as ezBarCurlBox } from './ez-bar-curl';
import { frames as facePull, viewBox as facePullBox } from './face-pull';
import { frames as forwardLunge, viewBox as forwardLungeBox } from './forward-lunge';
import { frames as frontRaise, viewBox as frontRaiseBox } from './front-raise';
import { frames as frontSquat, viewBox as frontSquatBox } from './front-squat';
import { frames as hackSquat, viewBox as hackSquatBox } from './hack-squat';
import { frames as hammerCurl, viewBox as hammerCurlBox } from './hammer-curl';
import { frames as hipAbductionMachine, viewBox as hipAbductionMachineBox } from './hip-abduction-machine';
import { frames as hipAdductionMachine, viewBox as hipAdductionMachineBox } from './hip-adduction-machine';
import { frames as hipThrust, viewBox as hipThrustBox } from './hip-thrust';
import { frames as inclineBenchPress, viewBox as inclineBenchPressBox } from './incline-bench-press';
import { frames as latPulldown, viewBox as latPulldownBox } from './lat-pulldown';
import { frames as lateralRaise, viewBox as lateralRaiseBox } from './lateral-raise';
import { frames as legExtension, viewBox as legExtensionBox } from './leg-extension';
import { frames as legPress, viewBox as legPressBox } from './leg-press';
import { frames as lyingLegCurl, viewBox as lyingLegCurlBox } from './lying-leg-curl';
import { frames as lyingLegRaise, viewBox as lyingLegRaiseBox } from './lying-leg-raise';
import { frames as machineGluteKickback, viewBox as machineGluteKickbackBox } from './machine-glute-kickback';
import { frames as oneArmDumbbellRow, viewBox as oneArmDumbbellRowBox } from './one-arm-dumbbell-row';
import { frames as overheadPress, viewBox as overheadPressBox } from './overhead-press';
import { frames as overheadTricepExtension, viewBox as overheadTricepExtensionBox } from './overhead-tricep-extension';
import { frames as pecDeck, viewBox as pecDeckBox } from './pec-deck';
import { frames as plank, viewBox as plankBox } from './plank';
import { frames as preacherCurl, viewBox as preacherCurlBox } from './preacher-curl';
import { frames as pullUp, viewBox as pullUpBox } from './pull-up';
import { frames as pushUp, viewBox as pushUpBox } from './push-up';
import { frames as rearDeltFly, viewBox as rearDeltFlyBox } from './rear-delt-fly';
import { frames as reverseCrunch, viewBox as reverseCrunchBox } from './reverse-crunch';
import { frames as romanianDeadlift, viewBox as romanianDeadliftBox } from './romanian-deadlift';
import { frames as ropeTricepPushdown, viewBox as ropeTricepPushdownBox } from './rope-tricep-pushdown';
import { frames as running, viewBox as runningBox } from './running';
import { frames as seatedCalfRaise, viewBox as seatedCalfRaiseBox } from './seated-calf-raise';
import { frames as seatedLegCurl, viewBox as seatedLegCurlBox } from './seated-leg-curl';
import { frames as seatedRow, viewBox as seatedRowBox } from './seated-row';
import { frames as shrug, viewBox as shrugBox } from './shrug';
import { frames as skullCrusher, viewBox as skullCrusherBox } from './skull-crusher';
import { frames as squat, viewBox as squatBox } from './squat';
import { frames as standingCalfRaise, viewBox as standingCalfRaiseBox } from './standing-calf-raise';
import { frames as straightArmPulldown, viewBox as straightArmPulldownBox } from './straight-arm-pulldown';
import { frames as tBarRow, viewBox as tBarRowBox } from './t-bar-row';
import { frames as tricepKickback, viewBox as tricepKickbackBox } from './tricep-kickback';
import { frames as tricepPushdown, viewBox as tricepPushdownBox } from './tricep-pushdown';
import { frames as uprightRow, viewBox as uprightRowBox } from './upright-row';

/** Os tres frames de cada movimento ilustrado, na ordem da animacao. */
export const FRAMES: Readonly<Record<string, readonly [string, string, string]>> = {
  'arnold-press': arnoldPress,
  'barbell-row': barbellRow,
  'bench-dip': benchDip,
  'bench-press': benchPress,
  'bicep-curl': bicepCurl,
  'bulgarian-split-squat': bulgarianSplitSquat,
  'cable-crunch': cableCrunch,
  'cable-curl': cableCurl,
  'cable-fly': cableFly,
  'cable-kickback': cableKickback,
  'chest-dip': chestDip,
  'concentration-curl': concentrationCurl,
  'crunch': crunch,
  'deadlift': deadlift,
  'decline-bench-press': declineBenchPress,
  'dumbbell-bench-press': dumbbellBenchPress,
  'dumbbell-fly': dumbbellFly,
  'ez-bar-curl': ezBarCurl,
  'face-pull': facePull,
  'forward-lunge': forwardLunge,
  'front-raise': frontRaise,
  'front-squat': frontSquat,
  'hack-squat': hackSquat,
  'hammer-curl': hammerCurl,
  'hip-abduction-machine': hipAbductionMachine,
  'hip-adduction-machine': hipAdductionMachine,
  'hip-thrust': hipThrust,
  'incline-bench-press': inclineBenchPress,
  'lat-pulldown': latPulldown,
  'lateral-raise': lateralRaise,
  'leg-extension': legExtension,
  'leg-press': legPress,
  'lying-leg-curl': lyingLegCurl,
  'lying-leg-raise': lyingLegRaise,
  'machine-glute-kickback': machineGluteKickback,
  'one-arm-dumbbell-row': oneArmDumbbellRow,
  'overhead-press': overheadPress,
  'overhead-tricep-extension': overheadTricepExtension,
  'pec-deck': pecDeck,
  'plank': plank,
  'preacher-curl': preacherCurl,
  'pull-up': pullUp,
  'push-up': pushUp,
  'rear-delt-fly': rearDeltFly,
  'reverse-crunch': reverseCrunch,
  'romanian-deadlift': romanianDeadlift,
  'rope-tricep-pushdown': ropeTricepPushdown,
  'running': running,
  'seated-calf-raise': seatedCalfRaise,
  'seated-leg-curl': seatedLegCurl,
  'seated-row': seatedRow,
  'shrug': shrug,
  'skull-crusher': skullCrusher,
  'squat': squat,
  'standing-calf-raise': standingCalfRaise,
  'straight-arm-pulldown': straightArmPulldown,
  't-bar-row': tBarRow,
  'tricep-kickback': tricepKickback,
  'tricep-pushdown': tricepPushdown,
  'upright-row': uprightRow,
};

/**
 * O quadro de cada movimento, ja apertado em volta do desenho.
 *
 * Sem isto toda figura usaria o quadro de origem de 512, que a arte ocupa de
 * forma irregular — de 188 a 482 de largura. O efeito era cada figura sair de
 * um tamanho aparente diferente, e as assimetricas sairem deslocadas.
 */
export const VIEW_BOXES: Readonly<Record<string, string>> = {
  'arnold-press': arnoldPressBox,
  'barbell-row': barbellRowBox,
  'bench-dip': benchDipBox,
  'bench-press': benchPressBox,
  'bicep-curl': bicepCurlBox,
  'bulgarian-split-squat': bulgarianSplitSquatBox,
  'cable-crunch': cableCrunchBox,
  'cable-curl': cableCurlBox,
  'cable-fly': cableFlyBox,
  'cable-kickback': cableKickbackBox,
  'chest-dip': chestDipBox,
  'concentration-curl': concentrationCurlBox,
  'crunch': crunchBox,
  'deadlift': deadliftBox,
  'decline-bench-press': declineBenchPressBox,
  'dumbbell-bench-press': dumbbellBenchPressBox,
  'dumbbell-fly': dumbbellFlyBox,
  'ez-bar-curl': ezBarCurlBox,
  'face-pull': facePullBox,
  'forward-lunge': forwardLungeBox,
  'front-raise': frontRaiseBox,
  'front-squat': frontSquatBox,
  'hack-squat': hackSquatBox,
  'hammer-curl': hammerCurlBox,
  'hip-abduction-machine': hipAbductionMachineBox,
  'hip-adduction-machine': hipAdductionMachineBox,
  'hip-thrust': hipThrustBox,
  'incline-bench-press': inclineBenchPressBox,
  'lat-pulldown': latPulldownBox,
  'lateral-raise': lateralRaiseBox,
  'leg-extension': legExtensionBox,
  'leg-press': legPressBox,
  'lying-leg-curl': lyingLegCurlBox,
  'lying-leg-raise': lyingLegRaiseBox,
  'machine-glute-kickback': machineGluteKickbackBox,
  'one-arm-dumbbell-row': oneArmDumbbellRowBox,
  'overhead-press': overheadPressBox,
  'overhead-tricep-extension': overheadTricepExtensionBox,
  'pec-deck': pecDeckBox,
  'plank': plankBox,
  'preacher-curl': preacherCurlBox,
  'pull-up': pullUpBox,
  'push-up': pushUpBox,
  'rear-delt-fly': rearDeltFlyBox,
  'reverse-crunch': reverseCrunchBox,
  'romanian-deadlift': romanianDeadliftBox,
  'rope-tricep-pushdown': ropeTricepPushdownBox,
  'running': runningBox,
  'seated-calf-raise': seatedCalfRaiseBox,
  'seated-leg-curl': seatedLegCurlBox,
  'seated-row': seatedRowBox,
  'shrug': shrugBox,
  'skull-crusher': skullCrusherBox,
  'squat': squatBox,
  'standing-calf-raise': standingCalfRaiseBox,
  'straight-arm-pulldown': straightArmPulldownBox,
  't-bar-row': tBarRowBox,
  'tricep-kickback': tricepKickbackBox,
  'tricep-pushdown': tricepPushdownBox,
  'upright-row': uprightRowBox,
};
