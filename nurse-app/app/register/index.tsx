import { useRouter } from 'expo-router'
import {
  BadgeCheck,
  CalendarClock,
  ClipboardCheck,
  FilePen,
  MessagesSquare,
  Phone,
  ShieldCheck,
  Wallet,
} from 'lucide-react-native'
import { ScrollView, useWindowDimensions, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText } from '../../components/AppText'
import { BenefitRow } from '../../components/BenefitRow'
import { Button } from '../../components/Button'
import { RegisterBanner } from '../../components/art/RegisterBanner'
import { ScreenHeader } from '../../components/ScreenHeader'
import { StepTimeline, type Step } from '../../components/StepTimeline'
import { theme } from '../../design/theme'

const BENEFITS = [
  {
    icon: CalendarClock,
    title: 'Ажлын цагаа өөрөө сонгоно',
    text: '«Дуудлага хүлээн авах» горимыг асаасан үедээ л дуудлага авна. Хүссэн цагтаа ажиллаж, хүсээгүй цагтаа амарна.',
  },
  {
    icon: Wallet,
    title: 'Үнэ, орлого урьдчилан тодорхой',
    text: 'Үйлчилгээ бүрийн үнэ, таны орлого дуудлагыг хүлээн авахаас өмнө харагдана. Үйлчлүүлэгчтэй үнэ тохиролцох шаардлагагүй.',
  },
  {
    icon: ClipboardCheck,
    title: 'Цахим тэмдэглэл',
    text: 'Амин үзүүлэлт, хийсэн ажилбар, үйлчлүүлэгчийн гарын үсгийг утсандаа хөтөлнө. Бичиг цаасгүй, дутуу бөглөх боломжгүй.',
  },
  {
    icon: ShieldCheck,
    title: 'Аюулгүй, ойлгомжтой дүрэм',
    text: 'Эмчийн заалт, эмийн хугацааг дуудлага дээр шалгаж, таарахгүй бол татгалзах эрхтэй. Эмчийн заалтгүй тарилга, дусал хийхгүй.',
  },
] as const

const STEPS: readonly Step[] = [
  { icon: FilePen, title: 'Өргөдөл илгээх', text: 'Нэр, утасны дугаар, мэргэжлийн зөвшөөрлийн дугаараа үлдээнэ.' },
  {
    icon: ShieldCheck,
    title: 'Баримт бичиг шалгах',
    text: 'Манай баг зөвшөөрөл, диплом, ажлын туршлагыг мэргэжлийн бүртгэлтэй тулган шалгана.',
  },
  {
    icon: MessagesSquare,
    title: 'Ярилцлага, сургалт',
    text: 'Богино ярилцлагад орж, ёс зүй болон халдвар хамгааллын сургалтыг дүүргэнэ.',
  },
  {
    icon: BadgeCheck,
    title: 'Баталгаажуулалт',
    text: 'Бүх шаардлагыг хангавал таны бүртгэл «Баталгаажсан» болж, ур чадварын шошго тавигдана.',
  },
  {
    icon: Phone,
    title: 'Ажиллаж эхлэх',
    text: 'Утасны дугаараараа нэвтэрч, «Дуудлага хүлээн авах» горимыг асаагаад дуудлага хүлээнэ.',
  },
]

export default function RegisterIntroScreen() {
  const router = useRouter()
  const { width } = useWindowDimensions()
  const contentWidth = Math.min(width, 560) - theme.space[3] * 2

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }}>
      <ScreenHeader title="Бүртгүүлэх" action={{ label: 'Нэвтрэх', onPress: () => router.replace('/login') }} />
      <ScrollView contentContainerStyle={{ padding: theme.space[3], gap: theme.space[4], paddingBottom: theme.space[5] }}>
        <View style={{ gap: theme.space[1] }}>
          <AppText variant="title" color={theme.color.navy} style={{ fontSize: 24, lineHeight: 32 }}>
            Мэргэжлээрээ ажиллаж, орлогоо нэмэгдүүлээрэй.
          </AppText>
          <AppText color={theme.color.secondary} style={{ fontSize: 16, lineHeight: 24 }}>
            Мэргэжлийн зөвшөөрөлтэй сувилагч та өргөдлөө илгээнэ үү. Баталгаажсаны дараа гэрийн сувилгааны дуудлага хүлээн
            авч эхэлнэ.
          </AppText>
        </View>

        <RegisterBanner width={contentWidth} />

        <View style={{ gap: theme.space[1] }}>
          <AppText variant="heading" color={theme.color.navy} style={{ fontSize: 20, lineHeight: 28 }} accessibilityRole="header">
            Яагаад ОТОЧ-ийг сонгох вэ?
          </AppText>
          <AppText color={theme.color.secondary} style={{ fontSize: 16, lineHeight: 24 }}>
            Баталгаажсан сувилагчийг үйлчлүүлэгчтэй холбож, үнэ болон эргэлтийн тэмдэглэлийг тодорхой хөтөлдөг платформ.
          </AppText>
        </View>

        <View style={{ gap: theme.space[4] }}>
          {BENEFITS.map((b) => (
            <BenefitRow key={b.title} icon={b.icon} title={b.title} text={b.text} />
          ))}
        </View>

        <View style={{ gap: theme.space[1] }}>
          <AppText variant="heading" color={theme.color.navy} style={{ fontSize: 20, lineHeight: 28 }} accessibilityRole="header">
            Хэрхэн бүртгүүлэх вэ?
          </AppText>
          <AppText color={theme.color.secondary} style={{ fontSize: 16, lineHeight: 24 }}>
            Доорх алхмуудаар өргөдлөө илгээж, баталгаажуулалтад орно.
          </AppText>
        </View>

        <StepTimeline steps={STEPS} />
      </ScrollView>

      <View style={{ padding: theme.space[3], borderTopWidth: 1, borderTopColor: theme.color.border, backgroundColor: theme.color.background }}>
        <Button label="Үргэлжлүүлэх" onPress={() => router.push('/register/form')} />
      </View>
    </SafeAreaView>
  )
}
