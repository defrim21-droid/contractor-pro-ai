export const COLOR_NAMES: Record<number, string> = {
  0: 'red',
  1: 'green',
  2: 'yellow',
  3: 'purple',
  4: 'orange',
};

export const CONSTRAINTS: Record<string, string> = {
  new_build:
    'This is a new build project. Focus on cohesive design, material consistency, and professional construction appearance. Preserve architectural intent and ensure materials fit the context. ',
  new_build_masked:
    'CRITICAL: The mask defines the ONLY area that may be modified. Transparent pixels in the mask = edit. Opaque pixels = DO NOT TOUCH. Do not apply any material, colour, or finish outside the masked region. Every pixel outside the mask must remain exactly as in the input image. Do not add moldings, trim, decorative elements, or any new architectural features. Only apply the specified material as a surface finish within the masked region—no additions. ' +
    'Use ONLY the specific material or finish the user names from the reference (e.g. stucco, brick, siding). If the reference contains multiple materials, isolate and apply only the one the user specifies. Do not transfer other materials, patterns, or finishes from the reference. ' +
    'Treat masked regions as unfinished construction substrate. Apply the requested material as an exterior finish system conforming exactly to the existing surface geometry without modifying structural form. ' +
    'The applied material must follow all existing reveals, returns, soffit depths, trim offsets, column curvature, and opening boundaries present in the original image. ' +
    'Simulate realistic installation of the material on top of the substrate including panel alignment, coursing, edge terminations, and corner transitions consistent with real world construction practices. ' +
    'Apply the finish system ONLY within the masked region. Do not extend material beyond mask boundaries. ' +
    'Maintain proper interface between installed material and adjacent trim, window frames, soffits, and fascia including realistic overlap, termination, and shadow interaction. ' +
    'Preserve all unmasked regions exactly including lighting, sky, ground conditions, structural framing, window glazing, and environmental elements. ',
  existing:
    "CRITICAL when a mask is used: Edit ONLY the masked area. Do not modify any pixel outside the mask. Do not add moldings, trim, decorative elements, or any new architectural features. Only apply the specified material as a surface finish within the masked region—nothing else. " +
    "The uploaded image is a real photograph and must be preserved exactly. Do not regenerate, enhance, or reinterpret the scene globally. Perform a localized material substitution only where required to fulfill the user's request. " +
    "Use ONLY the specific material the user names from the reference (e.g. stucco, brick). If the reference has multiple materials, extract and apply only that one. Do not transfer other materials from the reference. " +
    'Maintain identical camera position, orientation, focal length, perspective, vanishing lines, and lens distortion present in the original image. ' +
    'Preserve original lighting conditions including light direction, shadow placement, shadow softness, colour temperature, and ambient illumination. ' +
    'Do not modify any environmental elements including sky, landscaping, driveway, street, neighbouring buildings, vegetation, or reflections. ' +
    'Do not alter architectural geometry including wall boundaries, window openings, trim dimensions, soffits, fascia, roof lines, or corner profiles. ' +
    'Use the reference image strictly for material appearance such as texture, colour, finish, and reflectance. Do not transfer layout, scale, geometry, pattern placement, or lighting from the reference. ' +
    'Maintain realistic contact shadows and ambient occlusion at all transitions between the edited material and adjacent architectural elements. ' +
    'Do not apply global tone mapping, contrast adjustment, sharpening, or noise reduction to any unedited areas of the image. ',
  architectural_drawing:
    'This is an architectural drawing or plan. Interpret the drawing accurately. Apply materials and finishes to match the specified design intent. Maintain scale, proportions, and drawing conventions. ',
  architectural_drawing_masked:
    'CRITICAL: The mask defines the ONLY area that may be modified. Edit ONLY the masked region. Do not modify any area outside the mask. Do not add moldings, trim, or decorative elements. Only apply the specified material within the masked region—no additions. ' +
    'Use ONLY the specific material the user names from the reference (e.g. stucco, brick). If the reference has multiple materials, extract and apply only that one. Do not transfer other materials from the reference. ' +
    'Treat the uploaded architectural drawing as an orthographic front elevation representing fixed structural geometry. Do not modify proportions, opening dimensions, rooflines, wall boundaries, trim placement, or architectural layout. ' +
    'Preserve all original linework representing structural edges including wall intersections, window openings, trim outlines, rooflines, column boundaries, and fascia lines. ' +
    'Apply the selected finish system ONLY within the masked region. Do not extend material beyond masked boundaries. ' +
    'Convert masked regions from symbolic drawing surfaces into realistic exterior finish systems using the reference material as an appearance source. ' +
    'Simulate realistic installation depth including material thickness, trim projection, sill depth, reveal offsets, and corner conditions consistent with real world construction practices. ' +
    'Generate realistic lighting and shadow interaction across installed materials consistent with a plausible exterior daylight environment while maintaining the original facade geometry. ' +
    'Ensure realistic interaction between installed materials and architectural openings including shadowing at window frames, door returns, trim overlaps, soffits, and fascia. ' +
    'Use the reference image strictly as a material appearance source including texture, colour, finish, and surface behaviour. Do not transfer geometry, layout, pattern scale, or lighting conditions from the reference image. ' +
    'Preserve all unmasked drawing elements including annotations, dimensions, and structural outlines unless explicitly masked for material application. ',
};

export function buildPrompt(
  userPrompt: string,
  projectType: string | null,
  hasMask: boolean,
  regionContext?: { sampleIndex: number; sampleName: string; colorName: string }
): string {
  let constraint: string | undefined;
  if (projectType === 'new_build' && hasMask) {
    constraint = CONSTRAINTS['new_build_masked'];
  } else if (projectType === 'architectural_drawing' && hasMask) {
    constraint = CONSTRAINTS['architectural_drawing_masked'];
  } else if (projectType && CONSTRAINTS[projectType]) {
    constraint = CONSTRAINTS[projectType];
  }
  let instruction = userPrompt.trim();
  if (regionContext) {
    const colorHint = `The ${regionContext.colorName} masked area = ${regionContext.sampleName}. `;
    instruction = `Apply to this masked region ONLY. Use ONLY the material from the single reference image provided—it is ${regionContext.sampleName} (e.g. stucco, brick, siding). Do not use any other material. Do not add moldings, trim, or decorative elements. Only apply the material as a surface finish within the mask—nothing else. ${colorHint}User instruction: ${instruction}`;
  }
  if (constraint) {
    instruction = `${constraint}${instruction}`;
  }
  return instruction;
}
