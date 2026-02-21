import fragmentShaderSource from './shader.glsl';

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
	});

	const module = device.createShaderModule({
		label: 'our hardcoded red triangle shaders',
		code: /* wgsl */ `
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
		`,
	});

	const pipeline = device.createRenderPipeline({
		label: 'our hardcoded red triangle pipeline',
		layout: 'auto',
		vertex: {
		  module,
		  entryPoint: 'vs',
		},
		fragment: {
		  module,
		  entryPoint: 'fs',
		  targets: [{ format: presentationFormat }],
		},
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
	}as GPURenderPassDescriptor;

	function render() {
        // Получаем текущую текстуру из canvas context и устанавливаем ее как текстуру для рендеринга
        (renderPassDescriptor.colorAttachments as GPURenderPassColorAttachment[])[0].view =
            context!.getCurrentTexture().createView();
     
        // создаем шаблон команды, чтобы запускать их
        const encoder = device!.createCommandEncoder({ label: 'our encoder' });
     
        // создаем render pass encoder для установке нашего шаблона
        const pass = encoder.beginRenderPass(renderPassDescriptor);
        pass.setPipeline(pipeline);
        pass.draw(3);  // вызываем наш vertex shader три раза
        pass.end();
     
        const commandBuffer = encoder.finish();
        device!.queue.submit([commandBuffer]);
      }
     
      render();
}

init();

