import { ComputeShader,
     Texture,
     RawTexture,
     Scene,
     Vector3,
     FreeCamera,
     WebGPUEngine,
 } from '@babylonjs/core';

const canvas = <HTMLCanvasElement>document.getElementById("renderCanvas");

var engine;
var scene;

const createScene = async function () {

    engine = new WebGPUEngine(canvas);
    await engine.initAsync();

    // This creates a basic Babylon Scene object (non-mesh)
    scene = new Scene(engine);

    // This creates and positions a free camera (non-mesh)
    var camera = new FreeCamera("camera1", new Vector3(0, 5, -10), scene);
    // This targets the camera to scene origin
    camera.setTarget(Vector3.Zero());

    // This attaches the camera to the canvas
    camera.attachControl(canvas, true);

    engine.runRenderLoop(function () {
        scene.render();
    });
}

createScene();

// const [scene, engine] = await createScene();

const inputElement = document.getElementById("input");
inputElement.addEventListener("change", handleFiles, false);

function handleFiles() {
    const fileList = this.files;
    if (fileList && fileList[0]) {
        const file = fileList[0];
        let reader = new FileReader();
        reader.readAsDataURL(file);
        reader.addEventListener("load", () => {
            let img: string = reader.result as string;
            // var layer = new Layer('', new URL(img, import.meta.url).toString(), scene, true);

            // var ground = MeshBuilder.CreateGround("ground", { width: 6, height: 6 }, scene);

            const src = new Texture(img, scene);
            const dest = RawTexture.CreateRGBAStorageTexture(null, 1920, 1080, scene, false, false);

            // gpu compute shader
            const copyTextureComputeShader = `
        @group(0) @binding(0) var dest : texture_storage_2d<rgba8unorm,write>;
        @group(0) @binding(1) var samplerSrc : sampler;
        @group(0) @binding(2) var src : texture_2d<f32>;
    
        @compute @workgroup_size(1, 1, 1)
    
        fn main(@builtin(global_invocation_id) global_id : vec3<u32>) {
            let dims : vec2<f32> = vec2<f32>(textureDimensions(src, 0));
            let pix : vec4<f32> = textureSampleLevel(src, samplerSrc, vec2<f32>(global_id.xy) / dims, 0.0);
            textureStore(dest, vec2<i32>(global_id.xy), vec4<f32>(1.0, 1.0, 1.0, 2) - pix);
        }
    `;

            const cs1 = new ComputeShader("myCompute", engine, { computeSource: copyTextureComputeShader }, {
                bindingsMapping:
                {
                    "dest": { group: 0, binding: 0 },
                    "src": { group: 0, binding: 2 }
                }
            });

            cs1.setTexture("src", src);
            cs1.setStorageTexture("dest", dest);

            cs1.dispatchWhenReady(dest.getSize().width, dest.getSize().height, 1).then(() => {
                dest.readPixels().then((data) => {
                    console.log(data);

                    const imgPreview = <HTMLCanvasElement>document.querySelector("#previewCanvas");
                    imgPreview.width = 1920;
                    imgPreview.height = 1080;
                    const ctx = imgPreview.getContext('2d');
                    const pixels = new Uint8ClampedArray(data.buffer);
                    ctx.putImageData(new ImageData(pixels, 1920, 1080), 0, 0);


                    // imgPreview.src = URL.createObjectURL(
                    //   new Blob([data.buffer], { type: 'image/png' })
                    // );
                });
            });

            // const mat = new StandardMaterial("mat", scene);
            // mat.emissiveTexture = dest;
            // ground.material = mat;
            ;
        })
    }
}