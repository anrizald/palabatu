import { useState, type ImgHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, 'onError'> & {
    fallback: LucideIcon
    fallbackColor?: string
}

export default function FallbackImg({ fallback: Icon, fallbackColor = '#f0e0c8', width, height, className, style, ...imgProps }: Props) {
    const [failed, setFailed] = useState(false)

    if (failed) {
        const size = typeof width === 'number' ? width : typeof height === 'number' ? height : 24
        return <Icon size={size} color={fallbackColor} className={className} style={style} />
    }

    return (
        <img
            {...imgProps}
            width={width}
            height={height}
            className={className}
            style={style}
            onError={() => setFailed(true)}
        />
    )
}
