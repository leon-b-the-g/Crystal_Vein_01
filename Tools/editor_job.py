"""
The work loop's editor job (DevLoop.bat, editor.request): Unreal runs this file in its editor without a window
(UnrealEditor-Cmd -run=pythonscript). It makes what the code asks for and only the editor can make:

  1. the Meshy art in SourceArt/Meshy, imported to /Game/CrystalVein/Meshy/<Name>/SM_<Name> (left alone when already there),
     with Nanite switched off: the import turns it on, these meshes are a few thousand triangles, and their material is not
     flagged for Nanite, so the game would draw only the halved fallback mesh and warn at every start
  2. M_Meshy and an instance of it for each of those meshes (MI_<Name>, with the mesh's own three textures): the import's
     materials hang on an engine material that is not flagged for instanced meshes, and outside the editor the game then draws
     them with the default grey (seen on 20 Nov). This one is flagged, in the asset. M_MeshyAlive is the same and breathes
     (ALIVE below says which meshes wear it): every mound swells out from its own middle and settles, 4 % sideways and 12 % up,
     once in four seconds, a wave across the patch. In the material, because moving sixty-four instances from code every frame
     cost 30 ms a frame.
  3. M_Mist, the red mist's material (/Game/CrystalVein/Materials/M_Mist): translucent, unlit, soft at its edges and where it
     meets the floor; parameters Color and Opacity (ACVWorldView sets Opacity a cloud)

What it did goes to Saved/DevLoop/editor_job.log, a line a step, the last line "done" or "failed: <how many>"; a failed
step also fails the job (editor.result is not 0).
shortcut: one fixed list of art and one material; a table of jobs when there are more than a handful.
"""
import os
import traceback

import unreal

PROJECT = unreal.Paths.convert_relative_path_to_full(unreal.Paths.project_dir())
LOG = os.path.join(PROJECT, 'Saved', 'DevLoop', 'editor_job.log')
ART = os.path.join(PROJECT, 'SourceArt', 'Meshy')
# the file under SourceArt/Meshy, and the name it has in the project (SourceArt/PROVENANCE.md says where each came from)
MESHY = [
    ('mite/mite.glb', 'Mite'),
    ('crawler/crawler.glb', 'Crawler'),
    ('creep/mass.glb', 'Mass'),
    ('creep/crust.glb', 'Crust'),
    ('creep/crystal.glb', 'Crystal'),
    ('creep/feelers.glb', 'Feelers'),
    ('creep/sporepod.glb', 'SporePod'),
]
ALIVE = ('Mass',)
assets = unreal.EditorAssetLibrary
failures = []


def say(line):
    unreal.log('editor_job: ' + line)
    with open(LOG, 'a', encoding='utf-8') as out:
        out.write(line + '\n')


def static_meshes(paths):
    found = []
    for path in paths:
        data = assets.find_asset_data(path)
        if data.is_valid() and str(data.asset_class_path.asset_name) == 'StaticMesh':
            found.append(str(data.package_name))
    return found


def import_meshy(relative, name):
    folder = '/Game/CrystalVein/Meshy/' + name
    wanted = folder + '/SM_' + name
    if assets.does_asset_exist(wanted):
        say('%s: there already' % wanted)
        return
    source = os.path.join(ART, *relative.split('/'))
    if not os.path.isfile(source):
        raise RuntimeError('no file SourceArt/Meshy/' + relative)
    task = unreal.AssetImportTask()
    task.set_editor_property('filename', source)
    task.set_editor_property('destination_path', folder)
    task.set_editor_property('automated', True)
    task.set_editor_property('replace_existing', True)
    task.set_editor_property('save', True)
    try:
        task.set_editor_property('async_', False)  # the commandlet ends with the script: the import must be done by then
    except Exception:
        pass
    unreal.AssetToolsHelpers.get_asset_tools().import_asset_tasks([task])
    meshes = static_meshes(task.get_editor_property('imported_object_paths') or [])
    if not meshes:
        meshes = static_meshes(assets.list_assets(folder, recursive=True))  # Interchange does not always report what it made
    if not meshes:
        raise RuntimeError('the import made no static mesh from ' + relative)
    if meshes[0] != wanted and not assets.rename_asset(meshes[0], wanted):
        raise RuntimeError('could not rename %s to %s' % (meshes[0], wanted))
    assets.save_directory(folder, only_if_is_dirty=False, recursive=True)
    mesh = unreal.load_asset(wanted)
    box = mesh.get_bounding_box()
    size = box.max - box.min
    say('%s: imported from %s, %.0f x %.0f x %.0f cm, %d other assets beside it' % (
        wanted, relative, size.x, size.y, size.z, len(assets.list_assets(folder, recursive=True)) - 1))


def no_nanite(name):
    path = '/Game/CrystalVein/Meshy/%s/SM_%s' % (name, name)
    mesh = unreal.load_asset(path)
    if mesh is None:
        raise RuntimeError('no mesh at ' + path)
    settings = mesh.get_editor_property('nanite_settings')
    if not settings.get_editor_property('enabled'):
        say('%s: no Nanite, %d triangles' % (path, mesh.get_num_triangles(0)))
        return
    before = mesh.get_num_triangles(0)
    settings.set_editor_property('enabled', False)
    mesh.set_editor_property('nanite_settings', settings)  # the change rebuilds the mesh (no mesh editor subsystem in a commandlet)
    if mesh.get_editor_property('nanite_settings').get_editor_property('enabled'):
        raise RuntimeError('Nanite is still on for ' + path)
    if not assets.save_asset(path, only_if_is_dirty=False):
        raise RuntimeError('could not save ' + path)
    say('%s: Nanite switched off, %d triangles (its fallback had %d)' % (path, mesh.get_num_triangles(0), before))


def textures_of(name):
    """the three textures the import made for a mesh, told apart by how it set them up: {'BaseColor', 'Normal', 'ORM'}"""
    found = {}
    for path in assets.list_assets('/Game/CrystalVein/Meshy/' + name, recursive=True):
        data = assets.find_asset_data(path)
        if not data.is_valid() or str(data.asset_class_path.asset_name) != 'Texture2D':
            continue
        texture = unreal.load_asset(str(data.package_name))
        if texture.get_editor_property('compression_settings') == unreal.TextureCompressionSettings.TC_NORMALMAP:
            found['Normal'] = texture
        elif texture.get_editor_property('srgb'):
            found['BaseColor'] = texture
        else:
            found['ORM'] = texture  # glTF packs roughness in green and metallic in blue
    if sorted(found) != ['BaseColor', 'Normal', 'ORM']:
        raise RuntimeError('%s: expected a colour, a normal and a roughness texture, found %s' % (name, sorted(found)))
    return found


def make_meshy_base(title, breathes):
    path = '/Game/CrystalVein/Materials/' + title
    if assets.does_asset_exist(path):
        say(path + ': there already')
        return
    library = unreal.MaterialEditingLibrary
    defaults = textures_of(MESHY[0][1])
    material = unreal.AssetToolsHelpers.get_asset_tools().create_asset(title, '/Game/CrystalVein/Materials', unreal.Material, unreal.MaterialFactoryNew())

    def node(kind, row, **properties):
        made = library.create_material_expression(material, kind, -1500 + 220 * (row % 6), 700 + 160 * (row // 6))
        for name, value in properties.items():
            made.set_editor_property(name, value)
        return made

    def wire(source, target, pin):
        # a node with one input does not know it by name
        if not any(library.connect_material_expressions(source, '', target, name) for name in (pin, '')):
            raise RuntimeError('%s: cannot wire %s into pin "%s" of %s' % (title, source.get_name(), pin, target.get_name()))

    if breathes:
        vector = unreal.MaterialExpressionConstant3Vector
        middle = node(unreal.MaterialExpressionTransformPosition, 0,  # the instance's own origin, in the world
                      transform_source_type=unreal.MaterialPositionTransformSource.TRANSFORMPOSSOURCE_INSTANCE,
                      transform_type=unreal.MaterialPositionTransformSource.TRANSFORMPOSSOURCE_WORLD)
        wire(node(vector, 1, constant=unreal.LinearColor(0.0, 0.0, 0.0, 0.0)), middle, 'Input')
        out = node(unreal.MaterialExpressionSubtract, 2)  # from its middle to this vertex
        wire(node(unreal.MaterialExpressionWorldPosition, 3), out, 'A')
        wire(middle, out, 'B')
        swell = node(unreal.MaterialExpressionMultiply, 4)
        wire(out, swell, 'A')
        wire(node(vector, 5, constant=unreal.LinearColor(0.04, 0.04, 0.12, 0.0)), swell, 'B')
        phase = node(unreal.MaterialExpressionDotProduct, 6)  # later the further along the deck: 0.006 rad a cm, as seconds
        wire(middle, phase, 'A')
        wire(node(vector, 7, constant=unreal.LinearColor(0.00375, 0.00375, 0.0, 0.0)), phase, 'B')
        when = node(unreal.MaterialExpressionAdd, 8)
        wire(node(unreal.MaterialExpressionTime, 9), when, 'A')
        wire(phase, when, 'B')
        wave = node(unreal.MaterialExpressionSine, 10, period=3.927)  # 1.6 rad a second
        wire(when, wave, 'Input')
        breath = node(unreal.MaterialExpressionMultiply, 11)
        wire(swell, breath, 'A')
        wire(wave, breath, 'B')
        if not library.connect_material_property(breath, '', unreal.MaterialProperty.MP_WORLD_POSITION_OFFSET):
            raise RuntimeError(title + ': cannot wire the breath into the world position offset')
    nodes = {}
    for row, role in enumerate(('BaseColor', 'Normal', 'ORM')):
        sample = library.create_material_expression(material, unreal.MaterialExpressionTextureSampleParameter2D, -600, row * 300 - 300)
        sample.set_editor_property('parameter_name', role)
        sample.set_editor_property('texture', defaults[role])  # setting it also sets the sampler type to suit
        nodes[role] = sample
    library.connect_material_property(nodes['BaseColor'], 'RGB', unreal.MaterialProperty.MP_BASE_COLOR)
    library.connect_material_property(nodes['Normal'], 'RGB', unreal.MaterialProperty.MP_NORMAL)
    library.connect_material_property(nodes['ORM'], 'G', unreal.MaterialProperty.MP_ROUGHNESS)
    library.connect_material_property(nodes['ORM'], 'B', unreal.MaterialProperty.MP_METALLIC)
    # the point of it (5.8 renamed the call: the old name still works and warns)
    (getattr(library, 'set_base_material_usage', None) or library.set_material_usage)(material, unreal.MaterialUsage.MATUSAGE_INSTANCED_STATIC_MESHES)
    library.recompile_material(material)
    if not assets.save_asset(path, only_if_is_dirty=False):
        raise RuntimeError('could not save ' + path)
    say('%s: made, flagged for instanced meshes, sampler types %s%s' % (
        path, ', '.join('%s %s' % (role, made.get_editor_property('sampler_type').name) for role, made in nodes.items()),
        ', and it breathes' if breathes else ''))


def own_material(name):
    library = unreal.MaterialEditingLibrary
    folder = '/Game/CrystalVein/Meshy/' + name
    path = '%s/MI_%s' % (folder, name)
    mesh_path = '%s/SM_%s' % (folder, name)
    mesh = unreal.load_asset(mesh_path)
    if mesh is None:
        raise RuntimeError('no mesh at ' + mesh_path)
    base_path = '/Game/CrystalVein/Materials/' + ('M_MeshyAlive' if name in ALIVE else 'M_Meshy')
    if not assets.does_asset_exist(base_path):  # one half made by a failed step is in memory, not on the disk: not that one
        raise RuntimeError('no ' + base_path)
    base = unreal.load_asset(base_path)
    if assets.does_asset_exist(path):
        instance = unreal.load_asset(path)
        if instance.get_editor_property('parent') != base:
            library.set_material_instance_parent(instance, base)
            library.update_material_instance(instance)
            if not assets.save_asset(path, only_if_is_dirty=False):
                raise RuntimeError('could not save ' + path)
            say('%s: now an instance of %s' % (path, base.get_name()))
    else:
        instance = unreal.AssetToolsHelpers.get_asset_tools().create_asset('MI_' + name, folder, unreal.MaterialInstanceConstant, unreal.MaterialInstanceConstantFactoryNew())
        library.set_material_instance_parent(instance, base)
        for role, texture in textures_of(name).items():
            library.set_material_instance_texture_parameter_value(instance, role, texture)  # what it returns says nothing in 5.8: read back
            if library.get_material_instance_texture_parameter_value(instance, role) != texture:
                raise RuntimeError('%s takes no texture %s (the base has %s)' % (path, role, [str(n) for n in library.get_texture_parameter_names(base)]))
        library.update_material_instance(instance)
        if not assets.save_asset(path, only_if_is_dirty=False):
            raise RuntimeError('could not save ' + path)
        say(path + ': made')
    if mesh.get_material(0) == instance:
        say('%s: wears %s' % (mesh_path, instance.get_name()))
        return
    mesh.set_material(0, instance)
    if not assets.save_asset(mesh_path, only_if_is_dirty=False):
        raise RuntimeError('could not save ' + mesh_path)
    say('%s: now wears %s' % (mesh_path, instance.get_name()))


def make_mist():
    path = '/Game/CrystalVein/Materials/M_Mist'
    if assets.does_asset_exist(path):
        say(path + ': there already')
        return
    library = unreal.MaterialEditingLibrary
    material = unreal.AssetToolsHelpers.get_asset_tools().create_asset('M_Mist', '/Game/CrystalVein/Materials', unreal.Material, unreal.MaterialFactoryNew())
    material.set_editor_property('blend_mode', unreal.BlendMode.BLEND_TRANSLUCENT)
    material.set_editor_property('shading_model', unreal.MaterialShadingModel.MSM_UNLIT)
    color = library.create_material_expression(material, unreal.MaterialExpressionVectorParameter, -700, -120)
    color.set_editor_property('parameter_name', 'Color')
    color.set_editor_property('default_value', unreal.LinearColor(0.35, 0.0, 0.0, 1.0))  # red: alien
    library.connect_material_property(color, '', unreal.MaterialProperty.MP_EMISSIVE_COLOR)
    opacity = library.create_material_expression(material, unreal.MaterialExpressionScalarParameter, -900, 160)
    opacity.set_editor_property('parameter_name', 'Opacity')
    opacity.set_editor_property('default_value', 0.25)
    fresnel = library.create_material_expression(material, unreal.MaterialExpressionFresnel, -1100, 340)
    fresnel.set_editor_property('exponent', 1.5)
    soft = library.create_material_expression(material, unreal.MaterialExpressionOneMinus, -900, 340)  # thin at the rim, thick in the middle
    library.connect_material_expressions(fresnel, '', soft, '')
    thickness = library.create_material_expression(material, unreal.MaterialExpressionMultiply, -700, 240)
    library.connect_material_expressions(opacity, '', thickness, 'A')
    library.connect_material_expressions(soft, '', thickness, 'B')
    fade = library.create_material_expression(material, unreal.MaterialExpressionDepthFade, -480, 240)  # no hard line on the floor
    fade.set_editor_property('fade_distance_default', 80.0)
    if any(library.connect_material_expressions(thickness, '', fade, pin) for pin in ('Opacity', 'InOpacity')):
        library.connect_material_property(fade, '', unreal.MaterialProperty.MP_OPACITY)
    else:
        say(path + ': depth fade not wired, the mist meets the floor in a line')
        library.connect_material_property(thickness, '', unreal.MaterialProperty.MP_OPACITY)
    library.recompile_material(material)
    if not assets.save_asset(path, only_if_is_dirty=False):
        raise RuntimeError('could not save ' + path)
    say(path + ': made')


def step(name, work, *args):
    try:
        work(*args)
    except Exception:
        failures.append(name)
        say('%s: FAILED\n%s' % (name, traceback.format_exc()))


os.makedirs(os.path.dirname(LOG), exist_ok=True)
open(LOG, 'w', encoding='utf-8').close()
say('editor job, project ' + PROJECT)
for relative, name in MESHY:
    step(name, import_meshy, relative, name)
    step(name + ' Nanite', no_nanite, name)
step('M_Meshy', make_meshy_base, 'M_Meshy', False)
step('M_MeshyAlive', make_meshy_base, 'M_MeshyAlive', True)
for relative, name in MESHY:
    step(name + ' material', own_material, name)
step('M_Mist', make_mist)
say('done' if not failures else 'failed: %d (%s)' % (len(failures), ', '.join(failures)))
if failures:
    raise RuntimeError('editor job: %d steps failed, see Saved/DevLoop/editor_job.log' % len(failures))
