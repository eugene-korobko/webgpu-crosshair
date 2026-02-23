import shaderSrc from './shader.wgsl';

type DeepPartial<T> = T extends object ? {
	[P in keyof T]?: DeepPartial<T[P]>;
} : T;

function hexToNormalizedRGBA(hex: string): [number, number, number, number] {
	// Remove leading hash if present
	let cleanHex = hex.replace(/^#/, "");

	// Expand shorthand formats (e.g., "F00" -> "FF0000" or "F008" -> "FF000088")
	if (cleanHex.length === 3 || cleanHex.length === 4) {
		cleanHex = cleanHex
		.split("")
		.map((char) => char + char)
		.join("");
	}

	// Default alpha to FF (1.0) if only 6 digits are provided
	if (cleanHex.length === 6) {
		cleanHex += "FF";
	}

	if (cleanHex.length !== 8) {
		throw new Error("Invalid hex color format. Use 3, 4, 6, or 8 hex digits.");
	}

	// Parse pairs into decimals and normalize by 255
	const r = parseInt(cleanHex.slice(0, 2), 16) / 255;
	const g = parseInt(cleanHex.slice(2, 4), 16) / 255;
	const b = parseInt(cleanHex.slice(4, 6), 16) / 255;
	const a = parseInt(cleanHex.slice(6, 8), 16) / 255;

	return [
		parseFloat(r.toFixed(3)),
		parseFloat(g.toFixed(3)),
		parseFloat(b.toFixed(3)),
		parseFloat(a.toFixed(3)),
	];
}

async function init(): Promise<void> {
	const canvas = document.getElementById('glcanvas') as HTMLCanvasElement;

	const adapter = await navigator.gpu?.requestAdapter();
	const device = await adapter?.requestDevice();
	if (!device) {
		console.error('need a browser that supports WebGPU');
		return;
	}

	const context = canvas.getContext('webgpu') as unknown as GPUCanvasContext;
	if (!context) {
		console.error('cannot get webgpu context');
		return;
	}
	const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
	context.configure({
		device,
   		format: presentationFormat,
		alphaMode: 'premultiplied', // Enables transparency
	});

	const module = device.createShaderModule({
		label: 'our hardcoded red triangle shaders',
		code: shaderSrc,
	});

	const pipeline = device.createRenderPipeline({
		label: 'our hardcoded red triangle pipeline',
		layout: 'auto',
		vertex: {
		  module,
		  entryPoint: 'vs',
		},
		primitive: { topology: `triangle-list` },
		fragment: {
		  module,
		  entryPoint: 'fs',
		  targets: [
			{
				format: presentationFormat,
				blend: {
					color: {
						srcFactor: 'src-alpha',
						dstFactor: 'one-minus-src-alpha',
						operation: 'add',
					},
					alpha: {
						srcFactor: 'one', // Typically 'one' or 'src-alpha' for alpha channel
						dstFactor: 'one-minus-src-alpha',
						operation: 'add',
					},
				}
			}
		],
		},
	});

		// 2 items of i32 
	const uniformCoordsBufferSize = 4 + 4;
	const uniformCoordsBuffer = device.createBuffer({
		size: uniformCoordsBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});

	const uniformCoordsValues = new Int32Array(uniformCoordsBufferSize / 4);

	uniformCoordsValues.set([-1, -1], 0);

	const uniformLineStyleBufferSize = 4 + 4//  style + width
	const uniformLineStyleOffsetWidth = 0;
	const uniformLineStyleOffsetStyle = 1;

	const uniformLineStyleBuffer = device.createBuffer({
		size: uniformLineStyleBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});

	const uniformLineStyleValues = new Int32Array(uniformLineStyleBufferSize / 4);
	uniformLineStyleValues.set([1], uniformLineStyleOffsetWidth);
	uniformLineStyleValues.set([0], uniformLineStyleOffsetStyle);

	const uniformLineColorBufferSize = 16;
	const uniformLineColorBuffer = device.createBuffer({
		size: uniformLineColorBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});
	const uniformLineColorValues = new Float32Array(uniformLineColorBufferSize / 4);
	uniformLineColorValues.set([1.0, 1.0, 1.0, 1.0], 0);

	const bindGroup = device.createBindGroup({
		layout: pipeline.getBindGroupLayout(0),
		entries: [
			{
				binding: 0,
				resource: uniformCoordsBuffer,
			},
			{
				binding: 1,
				resource: uniformLineStyleBuffer,
			},
			{
				binding: 2,
				resource: uniformLineColorBuffer,
			}
		],
	});

	const renderPassDescriptor = {
		label: 'our basic canvas renderPass',
		colorAttachments: [
		  {
			// view: <- Чтобы текстура была заполнена внутри
			clearValue: [0.3, 0.3, 0.3, 1],
			loadOp: 'clear',
			storeOp: 'store',
		  },
		],
	} as GPURenderPassDescriptor;

	device!.queue.writeBuffer(uniformLineStyleBuffer, 0, uniformLineStyleValues);
	device!.queue.writeBuffer(uniformLineColorBuffer, 0, uniformLineColorValues);

	function render() {
		// Получаем текущую текстуру из canvas context и устанавливаем ее как текстуру для рендеринга
		(renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[0].view =
			context!.getCurrentTexture().createView();
	 
		// создаем шаблон команды, чтобы запускать их
		const encoder = device!.createCommandEncoder({ label: 'our encoder' });
	 
		// создаем render pass encoder для установке нашего шаблона
		const pass = encoder.beginRenderPass(renderPassDescriptor);
		pass.setPipeline(pipeline);
		pass.setBindGroup(0, bindGroup);
		pass.draw(12);
		pass.end();
	 
		const commandBuffer = encoder.finish();
		device!.queue.submit([commandBuffer]);
	}

	render();

	canvas.onmousemove = (e: MouseEvent) => {
		const rect = canvas.getBoundingClientRect();
		const x = Math.round((e.clientX - rect.left) * window.devicePixelRatio);
		const y = Math.round((e.clientY - rect.top) * window.devicePixelRatio);
		uniformCoordsValues.set([x, y], 0);
		device!.queue.writeBuffer(uniformCoordsBuffer, 0, uniformCoordsValues);
		render();
	};

	const lineWidthInput = document.getElementById('line-width') as HTMLInputElement;
	lineWidthInput.onchange= () => {
		const val = lineWidthInput.value;
		const width = parseInt(val);
		if (width > 0 && width < 10) {
			uniformLineStyleValues.set([width], 0);
			device!.queue.writeBuffer(uniformLineStyleBuffer, 0, uniformLineStyleValues);
			render();
		}
	};

	const lineStyleSelect = document.getElementById('line-style') as HTMLSelectElement;
	lineStyleSelect.onchange = () => {
		const style = parseInt(lineStyleSelect.value);
		uniformLineStyleValues.set([style], 1);
		device!.queue.writeBuffer(uniformLineStyleBuffer, 0, uniformLineStyleValues);
		render();
	};

	const lineColorInput = document.getElementById('line-color') as HTMLInputElement;
	lineColorInput.onchange = () => {
		const val = lineColorInput.value;
		try {
			const parsed = hexToNormalizedRGBA(val);
			uniformLineColorValues.set(parsed, 0);
			device!.queue.writeBuffer(uniformLineColorBuffer, 0, uniformLineColorValues);
			render();
		} catch {
		}
	};
}

init();

