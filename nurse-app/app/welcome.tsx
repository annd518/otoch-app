import { useRouter } from 'expo-router'
import { BadgeCheck, CalendarClock, ClipboardCheck, FileSignature, ShieldCheck, Wallet } from 'lucide-react-native'
import { useRef, useState } from 'react'
import { Image, ScrollView, useWindowDimensions, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText } from '../components/AppText'
import { Button } from '../components/Button'
import { ArchArt } from '../components/art/ArchArt'
import { theme } from '../design/theme'

const WORDMARK = require('../assets/brand/otoch-wordmark.png')

const SLIDES = [
  { title: 'Баталгаажсан сувилагчдын сүлжээ', left: ShieldCheck, right: BadgeCheck },
  { title: 'Үнэ, орлого урьдчилан тодорхой', left: Wallet, right: CalendarClock },
  { title: 'Цахим тэмдэглэл, аюулгүй ажил', left: ClipboardCheck, right: FileSignature },
] as const

// First screen for a signed-out nurse: what ОТОЧ is, then "sign in" or "register".
export default function WelcomeScreen() {
  const router = useRouter()
  const { width, height } = useWindowDimensions()
  const [page, setPage] = useState(0)
  const scroller = useRef<ScrollView>(null)
  // Leave room for the sheet (about 330 px) and the wordmark.
  const artWidth = Math.max(180, Math.min(width - 56, 300, (height - 330 - 150) * (300 / 280)))

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) =>
    setPage(Math.round(e.nativeEvent.contentOffset.x / width))

  return (
    <View style={{ flex: 1, backgroundColor: '#0F4075' }}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        <View style={{ paddingHorizontal: theme.space[3], paddingTop: theme.space[2], flexDirection: 'row', alignItems: 'center', gap: theme.space[2] }}>
          <Image source={WORDMARK} resizeMode="contain" accessibilityLabel="ОТОЧ" style={{ width: 112, height: 38 }} />
          <View style={{ borderRadius: 999, borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)', paddingHorizontal: 10, paddingVertical: 2 }}>
            <AppText variant="caption" color="#FFFFFF">
              Сувилагч
            </AppText>
          </View>
        </View>

        <View style={{ flex: 1, justifyContent: 'center' }}>
          <ScrollView
            ref={scroller}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            style={{ flexGrow: 0 }}
            onMomentumScrollEnd={onScrollEnd}
            accessibilityHint="Дараагийн танилцуулга руу шудрана"
          >
            {SLIDES.map((slide) => (
              <View key={slide.title} style={{ width, alignItems: 'center', gap: theme.space[3], paddingHorizontal: theme.space[3] }}>
                <AppText variant="heading" color="#FFFFFF" style={{ textAlign: 'center' }}>
                  {slide.title}
                </AppText>
                <ArchArt width={artWidth} left={slide.left} right={slide.right} />
              </View>
            ))}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 8, paddingTop: theme.space[1] }} accessibilityElementsHidden>
            {SLIDES.map((s, i) => (
              <View
                key={s.title}
                style={{ width: i === page ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i === page ? '#FFB82B' : 'rgba(255,255,255,0.4)' }}
              />
            ))}
          </View>
        </View>
      </SafeAreaView>

      <SafeAreaView
        edges={['bottom']}
        style={{ backgroundColor: theme.color.background, borderTopLeftRadius: 28, borderTopRightRadius: 28 }}
      >
        <View style={{ padding: theme.space[4], gap: theme.space[2] }}>
          <AppText variant="heading" style={{ textAlign: 'center', fontSize: 21, lineHeight: 28 }} color={theme.color.navy}>
            ОТОЧ сувилагчийн аппад тавтай морил
          </AppText>
          <AppText variant="caption" color={theme.color.secondary} style={{ textAlign: 'center', fontSize: 15, lineHeight: 22 }}>
            Гэрээр сувилуулахыг хүссэн үйлчлүүлэгчийг мэргэжлийн зөвшөөрөлтэй сувилагчтай холбодог платформ. Үнэ тодорхой,
            эргэлт бүр цахим тэмдэглэлтэй.
          </AppText>
          <Button label="Нэвтрэх" variant="secondary" onPress={() => router.push('/login')} />
          <Button
            label="Шинээр бүртгүүлэх"
            onPress={() => router.push('/register')}
            style={{ backgroundColor: theme.color.navy }}
          />
        </View>
      </SafeAreaView>
    </View>
  )
}
