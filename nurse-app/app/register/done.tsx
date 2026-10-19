import { useLocalSearchParams, useRouter } from 'expo-router'
import { CheckCircle2 } from 'lucide-react-native'
import { View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { AppText } from '../../components/AppText'
import { Button } from '../../components/Button'
import { theme } from '../../design/theme'

export default function RegisterDoneScreen() {
  const router = useRouter()
  const { name, phone } = useLocalSearchParams<{ name?: string; phone?: string }>()
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.background }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: theme.space[4], gap: theme.space[3], alignItems: 'center' }}>
        <View
          style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: theme.color.successBg, alignItems: 'center', justifyContent: 'center' }}
        >
          <CheckCircle2 color={theme.color.success} size={52} />
        </View>
        <AppText variant="title" color={theme.color.navy} style={{ textAlign: 'center' }} accessibilityRole="header">
          Өргөдөл хүлээн авлаа
        </AppText>
        <AppText style={{ textAlign: 'center', fontSize: 16, lineHeight: 24 }}>
          {name ? `Баярлалаа, ${name}. ` : ''}Манай баг таны мэдээллийг шалгаж, {phone ?? 'таны утасны дугаараар'} тантай холбогдоно.
        </AppText>
        <AppText color={theme.color.secondary} style={{ textAlign: 'center', fontSize: 15, lineHeight: 22 }}>
          Баталгаажсаны дараа энэ утасны дугаараараа нэвтэрч, дуудлага хүлээн авч эхэлнэ. Мэргэжлийн зөвшөөрөл, дипломын
          хуулбарыг баталгаажуулалтын үед танаас авна.
        </AppText>
      </View>
      <View style={{ padding: theme.space[3] }}>
        <Button label="Нэвтрэх хуудас руу" onPress={() => router.replace('/login')} />
      </View>
    </SafeAreaView>
  )
}
