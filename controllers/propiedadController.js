import { validationResult} from "express-validator"
import { unlink } from 'node:fs/promises'
import { Precio, Categoria, Propiedad, Usuario, Mensaje } from '../models/index.js'
import { esVendedor, formatearFecha } from "../helpers/index.js"

const admin = async (req, res) => {

    // QueryString: valores en la url
    // req.query

    const {page: paginaActual} = req.query
    const expresionRegular = /^[0-9]$/ // Solo admite numeros de 0 a 9
    
    if(!expresionRegular.test(paginaActual)) {
        return res.redirect('/my-properties?page=1')
    }

    // limites y offset para el paginador
    const limitePorPagina = 5
    const salto_Offset = ((paginaActual * limitePorPagina) - limitePorPagina)

    const { id } = req.usuario

    try {

        const [ propiedades, totalPropiedades ] = await Promise.all([
            Propiedad.findAll({
                limit: limitePorPagina,
                offset: salto_Offset,
                where: {
                    userId: id
                },
                include: [ // Join: llamar otras tablas con llaves foraneas
                    { model: Categoria, as: 'categoria' },
                    { model: Precio, as: 'precio' },
                    { model: Mensaje, as: 'mensajes' },
                ]
            }),
            Propiedad.count({
                where: {
                    userId : id
                }
            })
        ])  

        res.render('propiedades/admin', {
            page: 'My properties',
            propiedades,
            paginas: Math.ceil(totalPropiedades / limitePorPagina), // ceil: Redondea hacia arriba
            paginaActual: Number(paginaActual),
            totalPropiedades,
            salto_Offset,
            limitePorPagina
        })
        
    } catch (error) {
        console.log(error)        
    }
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

const eliminar = async (req, res) => {

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

    // Eliminar la propiedad
    const borrar = await propiedad.destroy();
    
    if(borrar) {

        // Eliminar la imagen
        await unlink(`public/uploads/${propiedad.imagen}`)
        console.log(`Se eliminó la imagen ${propiedad.imagen}`)

        res.redirect('/my-properties')
    }
}

// Modifica el estado de la propiedad
const cambiarEstado = async (req, res) => {

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

    // Actualizar el estado
    propiedad.publicado = !propiedad.publicado

    await propiedad.save()

    res.json({
        resultado: true
    })

}

const mostrarPropiedad = async (req, res) => {

    const {id} = req.params

    if( typeof id !== 'string'){
        return res.redirect('/my-properties')
    }

    // Validar que la propiedad existe
    const propiedad = await Propiedad.findByPk(id, {
        include: [
            { model: Categoria, as: 'categoria' },
            { model: Precio, as: 'precio' }
        ]
    })

    if(!propiedad || !propiedad.publicado) {
        return res.redirect('/404')
    }

    // Identificar si el usuario ya inició sesión
    let isAdmin = false
    if(req.usuario) {
        isAdmin = true
    }

    res.render('propiedades/mostrar', {
        page: propiedad.title,
        propiedad,
        usuario: req.usuario, // null o usuario,
        // esVendedor = true o false
        esVendedor: esVendedor(req.usuario?.id, propiedad.userId),
        isAdmin
    })
}

const enviarMensaje = async (req, res) => {

    const {id} = req.params

    if( typeof id !== 'string'){
        return res.redirect('/my-properties')
    }

    // Validar que la propiedad existe
    const propiedad = await Propiedad.findByPk(id, {
        include: [
            { model: Categoria, as: 'categoria' },
            { model: Precio, as: 'precio' }
        ]
    })

    if(!propiedad) {
        return res.redirect('/404')
    }

    let resultado = validationResult(req)

    if(!resultado.isEmpty()) {
        
        return res.render('propiedades/mostrar', {
            page: propiedad.title,
            propiedad,
            usuario: req.usuario, // null o usuario,
            esVendedor: esVendedor(req.usuario?.id, propiedad.userId), // esVendedor = true o false
            errores: resultado.array()
        })
    }

    const { mensaje, email, phone } = req.body
    const { id: propiedadId } = req.params 
    const { id: usuarioId } = req.usuario

    // Almacenar el mensaje
    await Mensaje.create({
        mensaje,
        email, 
        phone, 
        propiedadId,
        usuarioId
    })

    res.render('propiedades/mostrar', {
        page: propiedad.title,
        propiedad,
        usuario: req.usuario, // null o usuario,
        // esVendedor = true o false
        esVendedor: esVendedor(req.usuario?.id, propiedad.userId),
        enviado: true
    })
}

// leer mensaje recibidos
const verMensajes = async (req, res) => {

    const {id} = req.params

    if( typeof id !== 'string'){
        return res.redirect('/my-properties')
    }

    // Validar que la propiedad existe
    const propiedad = await Propiedad.findByPk(id, {
        include: [
            { model: Mensaje, as: 'mensajes',
                include: [
                    { model: Usuario.scope('eliminarPassword'), as: 'usuario'}
                ]
            } 
        ]
    })

    if(!propiedad) {
        return res.redirect('/my-properties')
    }

    // Revisar que el que esta editando es el dueño de la propiedad
    if(propiedad.userId.toString() !== req.usuario.id.toString()) {
        return res.redirect('/my-properties')
    }

    res.render('propiedades/mensajes', {
        page: 'Messages',
        mensajes: propiedad.mensajes,
        formatearFecha
    })
}

export {
    admin,
    crear,
    guardar,
    agregarImagen,
    almacenarImagen,
    editar,
    guardarCambios, 
    eliminar,
    cambiarEstado,
    mostrarPropiedad,
    enviarMensaje,
    verMensajes
}