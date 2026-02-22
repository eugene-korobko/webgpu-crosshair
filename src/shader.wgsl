const width: f32 = 1536.0;
const height: f32 = 1200.0;

struct CoordStruct {
	x: i32,
	y: i32,
};

struct LineStruct {
	width: i32,
}
 
@group(0) @binding(0) var<uniform> coordStruct: CoordStruct;
@group(0) @binding(1) var<uniform> linesStruct: LineStruct;

//const lineWidth: f32 = 20 / width;

fn screenXToScaled(x: f32) -> f32 {
	return 2.0 * x / width - 1.0;
}

fn screenYToScaled(y: f32) -> f32 {
	return -(2.0 * y / height - 1.0);
}

struct LineVertex {
	@builtin(position) position: vec4f,
    @location(0) @interpolate(flat) lineIndex: i32,
}

@vertex fn vs(
	@builtin(vertex_index) vertexIndex : u32
) -> LineVertex {
	let fx = f32(coordStruct.x);
	let fy = f32(coordStruct.y);
	let scaledX = screenXToScaled(fx);
	let scaledY = screenYToScaled(fy);
	let lineWidth = f32(linesStruct.width * 4) / width;
	// TODO: There is an issue here
	// we use triangle_strip, but we should use triangle_list
	// to draw two lines
	let pos = array(
		// vertical line
		vec2f( scaledX - 2 * lineWidth, -1.0),
		vec2f( scaledX + 2 * lineWidth, -1.0),
		vec2f( scaledX - 2 * lineWidth, 1.0),
		vec2f( scaledX + 2 * lineWidth, 1.0),

		// horizontal line
		vec2f( -1.0, scaledY + 2 * lineWidth),
		vec2f( -1.0, scaledY - 2 * lineWidth),
		vec2f( 1.0, scaledY + 2 * lineWidth),
		vec2f( 1.0, scaledY - 2 * lineWidth)
	);

 	var vsOutput: LineVertex;
	vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
	vsOutput.lineIndex = select(1, 2, vertexIndex > 3);
	return vsOutput;
}

@fragment fn fs(fsInput: LineVertex) -> @location(0) vec4f {
	let back = vec4f(0.0, 0.0, 0.0, 0.0);
	let color = vec4f(0.0, 0.0, 1.0, 1.0);
	let targetX = coordStruct.x;
	let targetY = coordStruct.y;
	let halfWidth = i32(floor(f32(linesStruct.width) * 0.5));
	let correction = linesStruct.width % 2;
	if (fsInput.lineIndex == 1) {
		let ix: i32 = i32(fsInput.position[0]);
		return select(back, color, ix >= targetX - halfWidth && ix < targetX + halfWidth + correction);
	} else {
		let iy: i32 = i32(fsInput.position[1]);
		return select(back, color, iy >= targetY - halfWidth && iy < targetY + halfWidth + correction);
	}
}
