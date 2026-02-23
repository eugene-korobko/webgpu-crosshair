const width: f32 = 1536.0;
const height: f32 = 1200.0;

struct CoordStruct {
	x: i32,
	y: i32,
};

struct LineStruct {
	width: i32,
	style: i32,
}
 
@group(0) @binding(0) var<uniform> coordStruct: CoordStruct;
@group(0) @binding(1) var<uniform> linesStruct: LineStruct;
@group(0) @binding(2) var<uniform> lineColor: vec4f;

fn screenXToScaled(x: f32) -> f32 {
	return 2.0 * x / width - 1.0;
}

fn screenYToScaled(y: f32) -> f32 {
	return -(2.0 * y / height - 1.0);
}

fn checkDash(offset: i32, style: i32, lineWidth: i32) -> bool {
	if (style == 0) {
		// solid
		return true;
	}
	if (style == 1) {
		// dashed
		// ***---
		const totalPatternLen = 6;
		let scaledLength = totalPatternLen * lineWidth;
		let patternOffset = (offset % scaledLength) / lineWidth;
		return patternOffset < 3;
	}
	if (style == 2) {
		// dotted
		// *-
		const totalPatternLen = 2;
		let scaledLength = totalPatternLen * lineWidth;
		let patternOffset = (offset % scaledLength) / lineWidth;
		return patternOffset < 1;
	}
	return true;
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

	let pos = array(
		// vertical line
		vec2f( scaledX - 2 * lineWidth, -1.0),
		vec2f( scaledX + 2 * lineWidth, -1.0),
		vec2f( scaledX - 2 * lineWidth, 1.0),

		vec2f( scaledX + 2 * lineWidth, -1.0),
		vec2f( scaledX - 2 * lineWidth, 1.0),
		vec2f( scaledX + 2 * lineWidth, 1.0),

		// horizontal line
		vec2f( -1.0, scaledY + 2 * lineWidth),
		vec2f( -1.0, scaledY - 2 * lineWidth),
		vec2f( 1.0, scaledY + 2 * lineWidth),

		vec2f( -1.0, scaledY - 2 * lineWidth),
		vec2f( 1.0, scaledY + 2 * lineWidth),
		vec2f( 1.0, scaledY - 2 * lineWidth)
	);

 	var vsOutput: LineVertex;
	vsOutput.position = vec4f(pos[vertexIndex], 0.0, 1.0);
	vsOutput.lineIndex = select(1, 2, vertexIndex > 5);
	return vsOutput;
}

@fragment fn fs(fsInput: LineVertex) -> @location(0) vec4f {
	let back = vec4f(0.0, 0.0, 0.0, 0.0);
	let targetX = coordStruct.x;
	let targetY = coordStruct.y;
	let halfWidth = i32(floor(f32(linesStruct.width) * 0.5));
	let correction = linesStruct.width % 2;

	let ix: i32 = i32(fsInput.position[0]);
	let iy: i32 = i32(fsInput.position[1]);
	if (fsInput.lineIndex == 1) {
		if (!checkDash(iy, linesStruct.style, linesStruct.width)) {
			return back;
		}
		return select(back, lineColor, ix >= targetX - halfWidth && ix < targetX + halfWidth + correction);
	} else {
		if (!checkDash(ix, linesStruct.style, linesStruct.width)) {
			return back;
		}
		return select(back, lineColor, iy >= targetY - halfWidth && iy < targetY + halfWidth + correction);
	}
}
