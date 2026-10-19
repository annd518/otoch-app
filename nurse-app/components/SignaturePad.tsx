import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react'
import { PanResponder, View } from 'react-native'
import Svg, { Path, Rect } from 'react-native-svg'

import { theme } from '../design/theme'

export interface SignaturePadHandle {
  // PNG data URL of the drawing, or null when nothing was drawn.
  toPng(): Promise<string | null>
  clear(): void
}

interface Props {
  ref?: Ref<SignaturePadHandle>
  onInkChange?: (hasInk: boolean) => void
  // Lets the parent ScrollView stop scrolling while a stroke is drawn.
  onDrawing?: (drawing: boolean) => void
}

const HEIGHT = 180

export function SignaturePad({ ref, onInkChange, onDrawing }: Props) {
  const [strokes, setStrokes] = useState<string[]>([])
  const [drawing, setDrawing] = useState(false)
  const svgRef = useRef<Svg>(null)

  // Parent callbacks run from effects so the responder below only uses state setters.
  useEffect(() => {
    onInkChange?.(strokes.length > 0)
  }, [strokes, onInkChange])
  useEffect(() => {
    onDrawing?.(drawing)
  }, [drawing, onDrawing])

  useImperativeHandle(
    ref,
    () => ({
      clear: () => setStrokes([]),
      toPng: () =>
        new Promise((resolve) => {
          if (strokes.length === 0 || !svgRef.current) return resolve(null)
          svgRef.current.toDataURL((base64: string) => resolve(`data:image/png;base64,${base64.replace(/\s/g, '')}`))
        }),
    }),
    [strokes],
  )

  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (event) => {
        const { locationX: x, locationY: y } = event.nativeEvent
        const point = `${x.toFixed(1)} ${y.toFixed(1)}`
        setDrawing(true)
        setStrokes((list) => [...list, `M${point} L${point}`])
      },
      onPanResponderMove: (event) => {
        const { locationX: x, locationY: y } = event.nativeEvent
        setStrokes((list) =>
          list.length === 0
            ? list
            : [...list.slice(0, -1), `${list[list.length - 1]} L${x.toFixed(1)} ${y.toFixed(1)}`],
        )
      },
      onPanResponderRelease: () => setDrawing(false),
      onPanResponderTerminate: () => setDrawing(false),
    }),
  )

  return (
    <View
      accessible
      accessibilityLabel="Гарын үсгийн талбар"
      accessibilityHint="Үйлчлүүлэгч хуруугаараа энд гарын үсэг зурна"
      style={{
        height: HEIGHT,
        borderWidth: 1,
        borderColor: theme.color.border,
        borderRadius: theme.radius.small,
        overflow: 'hidden',
        backgroundColor: '#FFFFFF',
      }}
      {...responder.panHandlers}
    >
      <Svg ref={svgRef} width="100%" height={HEIGHT} pointerEvents="none">
        <Rect x="0" y="0" width="100%" height={HEIGHT} fill="#FFFFFF" />
        {strokes.map((d, i) => (
          <Path key={i} d={d} stroke="#0E284B" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        ))}
      </Svg>
    </View>
  )
}
