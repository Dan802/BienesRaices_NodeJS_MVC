import { validationResult} from "express-validator"
import { Precio, Categoria, Propiedad } from '../models/index.js'

const admin = async (req, res) => {

    const { id } = req.usuario

    const propiedades = await Propiedad.findAll({
        where: {
            userId: id
        },
        include: [ // Join: llamar otras tablas con llaves foraneas
            { model: Categoria, as: 'categoria' },
            { model: Precio, as: 'precio' },
        ]
    })

    res.render('propiedades/admin', {
        page: 'My properties',
        propiedades
    })
}

const crear = async (req,res) => {

    // Obtenemos los precios y categorias de la BD
    const [categorias, precios] = await Promise.all([
        Categoria.findAll(),
        Precio.findAll()
    ])

    res.render('propiedades/crear', {
        page: 'Create property',
        categorias, 
        precios,
        datos: {}
    })
}

const guardar = async (req, res) => {
    
    // Resultado Validacion
    let resultado = validationResult(req)

    if(!resultado.isEmpty()) {

         // Obtenemos los precios y categorias de la BD
        const [categorias, precios] = await Promise.all([
            Categoria.findAll(),
            Precio.findAll()
        ])
        
        return res.render('propiedades/crear', {
            page: 'Create property',
            categorias, 
            precios, 
            errores: resultado.array(),
            datos: req.body
        })
    }

    // Guardar la propiedad en al BD
    const {title, description, category : categoryId, price : priceId, rooms, parking_lot, wc, street, lat, lng } = req.body
    const { id: userId} = req.usuario

    try {
        const propiedadGuardada = await Propiedad.create({
            title,
            description,
            rooms,
            parking_lot,
            wc, 
            street,
            lat,
            lng,
            imagen: '',
            priceId,
            categoryId,
            userId
        })

        const {id} = propiedadGuardada
        res.redirect(`/properties/add-image/${id}`)
        
    } catch (error) {
        console.log(error)
    }
}

const agregarImagen = async (req, res) => {
    
    const {id} = req.params

    if( typeof id !== 'string'){
        return res.redirect('/my-properties')
    }

    // Validar que la propiedad exista
    const propiedad = await Propiedad.findByPk(id)

    if(!propiedad) {
        return res.redirect('/my-properties')
    }

    // Validar que la propiedad no este publicada
    if(propiedad.publicado) {
        return res.redirect('/my-properties')
    }

    // Validar que la propiedad pertenece a quien visita esta pagina
    if(req.usuario.id.toString() !== propiedad.userId.toString()){
        return res.redirect('/my-properties')
    }

    res.render('propiedades/agregar-imagen', {
        page: `Add Image: ${propiedad.title}`,
        propiedad: propiedad
    })
}

const almacenarImagen = async (req, res, next) => {
    const {id} = req.params

    if( typeof id !== 'string'){
        return res.redirect('/my-properties')
    }

    // Validar que la propiedad exista
    const propiedad = await Propiedad.findByPk(id)

    if(!propiedad) {
        return res.redirect('/my-properties')
    }

    // Validar que la propiedad no este publicada
    if(propiedad.publicado) {
        return res.redirect('/my-properties')
    }

    // Validar que la propiedad pertenece a quien visita esta pagina
    if(req.usuario.id.toString() !== propiedad.userId.toString()){
        return res.redirect('/my-properties')
    }

    try {
        
        // Almacenar la imagen y publicar la propiedad
        propiedad.imagen = req.file.filename
        propiedad.publicado = 1;

        await propiedad.save()

        // En el navegador del cliente se llama a dropzen en agregarImagen.js 
        // Y se redirige la pagina desde allí
        // Pero del lado del servidor no hemos recibido ninguna instruccion

        // Por eso colocamos next para "desbloquear" la ejecución
        next()  // Y seguir con el siguiente middleware

    } catch (error) {
        console.log(error)
    }
}

const editar = async (req, res) => {

    const {id} = req.params

    if( typeof id !== 'string'){
        return res.redirect('/my-properties')
    }

    // Validar que la propiedad existe
    const propiedad = await Propiedad.findByPk(id)

    if(!propiedad) {
        return res.redirect('/my-properties')
    }

    // Revisar que el que esta editando es el dueño de la propiedad
    if(propiedad.userId.toString() !== req.usuario.id.toString()) {
        return res.redirect('/my-properties')
    }

    // Obtenemos los precios y categorias de la BD
    const [categorias, precios] = await Promise.all([
        Categoria.findAll(),
        Precio.findAll()
    ])

    res.render('propiedades/editar', {
        page: `Edit Property ${propiedad.title}`,
        categorias, 
        precios,
        datos: propiedad
    })
}

const guardarCambios = async (req, res) => {

    // Verificar la validación
    let resultado = validationResult(req)

    if(!resultado.isEmpty()) {

         // Obtenemos los precios y categorias de la BD
        const [categorias, precios] = await Promise.all([
            Categoria.findAll(),
            Precio.findAll()
        ])
         
        return res.render('propiedades/editar', {
            page: 'Edit Property',
            categorias, 
            precios,
            errores: resultado.array(),
            datos: req.body
        })
    }

    const {id} = req.params

    if( typeof id !== 'string'){
        return res.redirect('/my-properties')
    }

    // Validar que la propiedad existe
    const propiedad = await Propiedad.findByPk(id)

    if(!propiedad) {
        return res.redirect('/my-properties')
    }

    // Revisar que el que esta editando es el dueño de la propiedad
    if(propiedad.userId.toString() !== req.usuario.id.toString()) {
        return res.redirect('/my-properties')
    }

    // Reescribir el objeto y actualizarlo
    try {
        
        const {title, description, category : categoryId, price : priceId, rooms, parking_lot, wc, street, lat, lng } = req.body

        propiedad.set({
            title,
            description,
            categoryId,
            priceId,
            rooms,
            parking_lot,
            wc,
            street,
            lat,
            lng
        })

        await propiedad.save()

        res.redirect('/my-properties')

    } catch (error) {
        console.log(error)
    }

    

}

export {
    admin,
    crear,
    guardar,
    agregarImagen,
    almacenarImagen,
    editar,
    guardarCambios
}