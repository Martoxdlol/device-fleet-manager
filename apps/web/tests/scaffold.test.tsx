import { describe, expect, test } from 'bun:test'
import { getInsets } from '../src/core/scaffold/geometry'

describe('layout geometry', () => {
    test('removed or hidden slots reclaim their space without guessed offsets', () => {
        const desktop = getInsets({
            'fixed-left': { width: 56, height: 900 },
            'floating-top': { width: 1384, height: 68 },
            'floating-left': { width: 258, height: 822 },
            'floating-right': { width: 282, height: 822 },
        })
        expect(desktop.content).toEqual({
            top: 68,
            right: 282,
            bottom: 0,
            left: 314,
        })
        const mobile = getInsets({
            'floating-top': { width: 390, height: 64 },
            'floating-bottom': { width: 390, height: 76 },
        })
        expect(mobile.content).toEqual({ top: 64, right: 0, bottom: 76, left: 0 })
    })
    test('each axis uses its relevant dimension, including fixed status bars', () => {
        expect(
            getInsets({
                'fixed-bottom': { width: 1440, height: 22 },
                'floating-bottom': { width: 1440, height: 74 },
                'fixed-right': { width: 40, height: 900 },
            }).content,
        ).toEqual({ top: 0, left: 0, right: 40, bottom: 96 })
    })
})
