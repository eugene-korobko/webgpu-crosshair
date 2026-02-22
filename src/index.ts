import shaderSrc from './shader.wgsl';

type DeepPartial<T> = T extends object ? {
	[P in keyof T]?: DeepPartial<T[P]>;
} : T;

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
		primitive: { topology: `triangle-strip` },
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
	const uniformCoordsBufferSize = 2 * 4;
	const uniformCoordsBuffer = device.createBuffer({
		size: uniformCoordsBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});

	const uniformCoordsValues = new Int32Array(uniformCoordsBufferSize / 4);

	uniformCoordsValues.set([-1, -1], 0);

	const uniformLineStyleBufferSize = 4;
	const uniformLineStyleBuffer = device.createBuffer({
		size: uniformLineStyleBufferSize,
		usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
	});

	const uniformLineStyleValues = new Int32Array(uniformLineStyleBufferSize / 4);
	uniformLineStyleValues.set([1], 0);

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
		pass.draw(8);
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
			console.log(`set width to ${width}`);
			uniformLineStyleValues.set([width], 0);
			device!.queue.writeBuffer(uniformLineStyleBuffer, 0, uniformLineStyleValues);
			render();
		}
	};
}

init();

