@vertex fn vs(
    @builtin(vertex_index) vertexIndex : u32
) -> @builtin(position) vec4f {
    let pos = array(
        vec2f( 0.0,  0.5),  // top center
        vec2f(-0.5, -0.5),  // bottom left
        vec2f( 0.5, -0.5)   // bottom right
    );

    return vec4f(pos[vertexIndex], 0.0, 1.0);
}

@fragment fn fs(@builtin(position) pixelPosition: vec4f) -> @location(0) vec4f {
    let x: i32 = i32(pixelPosition[0]);
    let odd: i32 = x % 10;
    let color1 = vec4f(1.0, 0.0, 0.0, 1.0);
    let color2 = vec4f(1.0, 0.0, 1.0, 1.0);
    return select(color1, color2, odd >= 5);
}
