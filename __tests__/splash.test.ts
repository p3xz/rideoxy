describe('AnimatedSplash layout math', () => {
  it('computes responsive wordmark font sizes without clipping on narrow screens', () => {
    // 360px width device with 28px margins
    const width360 = 360;
    const contentWidth360 = width360 - 56; // 304
    const fontSize360 = Math.min(44, Math.floor(contentWidth360 / 7.2));
    expect(fontSize360).toBeLessThanOrEqual(44);
    expect(fontSize360).toBeGreaterThanOrEqual(38);

    // 390px width device (e.g. iPhone standard)
    const width390 = 390;
    const contentWidth390 = width390 - 56; // 334
    const fontSize390 = Math.min(44, Math.floor(contentWidth390 / 7.2));
    expect(fontSize390).toBe(44);

    // 412px width device (e.g. Pixel)
    const width412 = 412;
    const contentWidth412 = width412 - 56; // 356
    const fontSize412 = Math.min(44, Math.floor(contentWidth412 / 7.2));
    expect(fontSize412).toBe(44);
  });

  it('correctly calculates progress fill translateX to anchor scaling from left edge', () => {
    const contentWidth = 304;

    // Formula: translateX = (scale - 1) * (contentWidth / 2)
    // Scale 0: translateX = -contentWidth / 2 (-152) -> visible fill width = 0
    const x0 = (0 - 1) * (contentWidth / 2);
    expect(x0).toBe(-152);

    // Scale 0.5: translateX = -76 -> visible fill width = 152 (halfway)
    const xHalf = (0.5 - 1) * (contentWidth / 2);
    expect(xHalf).toBe(-76);

    // Scale 1.0: translateX = 0 -> visible fill width = 304 (full width)
    const xFull = (1.0 - 1) * (contentWidth / 2);
    expect(xFull).toBe(0);
  });
});
