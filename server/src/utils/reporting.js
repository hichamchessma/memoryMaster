/* Back-End API */

const fs = require('fs')
const fastcsv = require("fast-csv")
const { v4: uuidv4 } = require("uuid")

const axios = require('axios')
const qs = require("qs")
const https = require("https")

/* Librairie pour la gestion des requetes */
const cors = require("cors")
const express = require("express")
const app = express()

/* cors security */
app.use(express.json())
app.disable("x-powered-by")
app.use(cors())

/* httpagent */
const httpsAgent = new https.Agent({
    rejectUnauthorized: false
})

/* Librairie POSTGRESQL */
const connectionString = require('./credentials/sql_creds.json').connectionString
const { Pool } = require("pg")
const pool = new Pool({
    connectionString
})
const knex = require('knex')({
    client: 'pg',
    connection: connectionString,
    searchPath: ['public'],
});
const sql_reqs = require('./ressources/sql_requests.js')

/* Ressources SITEMINDER */
const sm = require('./ressources/siteminder.json')
const { count } = require('console')

function logs(endpoint, err) {
    const log = new Date().toLocaleString('fr-FR') + '\n' + 'ENDPOINT ' + endpoint + '\n' + err + '\n\n'
    fs.appendFileSync('./logs/errors.txt', log)
    console.log(endpoint, err)
}

// telechargement des fichiers
app.get('/api/files/:file', async(req, res) => {
    try {
        // on evite faille de secu en envoyant directement le fichier sans verification du nom, peut
        const exports = fs.readdirSync('./exports')
        if (exports.includes(req.params.file)) {
            res.download('./exports/' + req.params.file, (err) => {
                if (err) {
                    logs('/api/files/', err)
                    res.status(500).end()
                }
                fs.unlinkSync('./exports/' + req.params.file)
            })
        } else {
            res.status(404).end()
        }
    } catch (err) {
        logs('/api/files/', err)
        res.status(500).end()
    }
})

// Function : formatter l'offset et la limit
function formatOffsetLimit(offset, limit) {
    const ret = [offset, limit]
    ret[0] = parseInt(ret[0])
    if (isNaN(ret[0]) || ret[0] < 0) ret[0] = 0;
    ret[1] = parseInt(ret[1])
    if (isNaN(ret[1]) || ret[1] < 0) ret[1] = 1;
    return ret;
}

// dynamic datatables
async function reqOffsetLimit(table, offset, limit, body) {
    const offsetLimit = formatOffsetLimit(offset, limit)
    let query = knex(table)
    Object.keys(body).forEach(function(e) {
        query = query.whereILike(e, '%' + body[e] + '%')
    })
    const ret = {
        objects: (await query.clone().select().offset(offsetLimit[0]).limit(offsetLimit[1])),
        count: (await query.clone().count())
    }
    return ret;
}

// transformer les valeurs de la colonne type de droit pour le fichier excel à exporter
function typeDroit(type) {
    if (type == 'bnpp_equipe') {
        type = 'Equipe'
    } else if (type == 'business') {
        type = 'Profil metier'
    } else if (type == 'it') {
        type = 'Droit'
    }
    return type;
}

async function executeSQL(queryBuilder) {
    try {
        return await queryBuilder;
    } catch (error) {
        console.err(error);
        throw error;
    }
}

// dynamic datatables excel.
const progress = {};
async function reqExcelHugeSizeFile(req, res, filename, chunkSize = 50000) {
    const offset = req.body.offset || 0;

    if(offset === 0){
        const totalCount = await executeSQL(knex('rapporthabilitation_myrecert').count('* as count'));
        progress[filename] = { totalCount: totalCount[0].count, processed: 0 };
    }
    let sqlQuery = knex('rapporthabilitation_myrecert').limit(chunkSize).offset(offset);
    let ret ;
    ret = await executeSQL(sqlQuery);

    if(ret.length > 0){
        if(filename == 'Rapport des droits'){
            ret.forEach(function(e){
                e.type = typeDroit(e.type)
            })
        } else if (filename == 'Rapport des habilitations' || filename == 'Rapport des demandes'){
            ret.forEach(function(e){
                e.type_droit = typeDroit(e.type_droit);
            })
        }
    

    const file = filename + '.csv'
    const fileName = './exports/' + file

    if(!progress[fileName]){
        const ws = fs.createWriteStream(fileName);
        const csvStream = fastcsv.format({ headers: true, delimiter: ';' });
        csvStream.pipe(ws);
        progress[fileName] = {
            totalCount: progress[filename].totalCount,
            processed: 0,
            ws: ws,
            csvStream: csvStream
        }
    }

    const { ws, csvStream } = progress[fileName];

    const chunk = ret.slice(0, chunkSize);


    chunk.forEach(row => csvStream.write(row));
    progress[fileName].processed += chunk.length;
    


    if(chunk.length < chunkSize){
        csvStream.end();
        delete progress[fileName];
        ws.on('finish', () => {
            res.json({ filename: file });
        });
        ws.on('error', (err) => {
            res.status(500).json({
                error: err.message
            });
        });
    } 
    else {
        res.json({
            progress: progress[fileName].processed / (progress[fileName].totalCount),
            nextOffset: progress[fileName].processed
        });
    }
    } 
    else {
        const file = filename + '.csv'
        const fileName = './exports/' + file
        if(progress[fileName]){
            const { csvStream, ws } = progress[fileName];
            csvStream.end();
            delete progress[fileName];
            ws.on('finish', () => {
                res.json({ filename: file });
            });
            ws.on('error', (err) => {
                res.status(500).json({
                    error: err.message
                });
            });
        } 
        else {
            res.status(500).json({ error: "No data to process" });
        }
    }

}
    
    // dynamic datatables excel
    async function reqExcel(sql, res, filename) {
        let ret = await sql
        if (ret['objects']) {
            ret = ret['objects']
        }
        if(filename == 'Rapport des droits') {
            ret.forEach(function(e) {
                e.type = typeDroit(e.type);
            })
        } else if (filename == 'Rapport des habilitations' || filename == 'Rapport des demandes') {
            ret.forEach(function(e) {
                e.type_droit = typeDroit(e.type_droit);
            })
        }
        const file = filename + '.csv'
        const fileName = './exports/' + file
        const ws = fs.createWriteStream(fileName)
        fastcsv.write(ret, { headers: true, delimiter: ';' }).on('end', (err) => {
            if (err) {
                throw new Error(err)
            }
            res.json({ filename: file })
        }).pipe(ws)
    }
    
    // dynamic datatables excel ; version sans les extensions chiffrées
    async function reqExcel_(sql, res, filename) {
        let ret = await sql
        if (ret['objects']) {
            ret = ret['objects']
        }
        if(filename == 'Roles_List') {
            ret.forEach(function(e) {
                e.type = typeDroit(e.type);
            })
        } else if (filename == 'Entitlements_List' || filename == 'Requests_List') {
            ret.forEach(function(e) {
                e.type_droit = typeDroit(e.type_droit);
            })
        }
    
        const file = filename + '.csv'
        const fileName = './exports/' + file
        const ws = fs.createWriteStream(fileName)
        fastcsv.write(ret, { headers: true, delimiter: ';' }).on('end', (err) => {
            if (err) {
                throw new Error(err)
            }
            res.json({ filename: file })
        }).pipe(ws)
    }


    // Le catalogue de droit est disponible sans sso
/* ENDPOINT POST : la liste des droits avec filtres possibles */
app.post('/api/rights/:offset/:limit', async(req, res) => {
    try {
        if(req.body.type)
            req.body.type = transformTypeDroit(req.body.type);
        const ret = await reqOffsetLimit('droits_list', req.params.offset, req.params.limit, req.body)
        res.json(ret)
    } catch (err) {
        logs('/api/rights/', err)
        res.status(500).end()
    }
})
/* ENDPOINT POST : Extraction de la liste des droits avec filtres possibles */
app.post('/api/rights/toExcel', async(req, res) => {
    try {
        if(req.body.type)
         req.body.type = transformTypeDroit(req.body.type);

        query = knex('droits_list')
        Object.keys(req.body).forEach(function(e) {
            query = query.whereILike(e, '%' + req.body[e] + '%')
        })
        await reqExcel(query.select(), res, 'Rapport des droits')
    } catch (err) {
        logs('/api/rights/toExcel', err)
        res.status(500).json({ error: 'Error on export' })
    }
})

/* ENDPOINT GET : le détail d'un droit avec son historisation */
app.get('/api/rights/:id', async(req, res) => {
    try {
        const right = await pool.query(sql_reqs['get_right_by_id'], [req.params.id])
        if (right.rows.length) {
            const data = { right: right.rows[0] };
            // only get habilitations for teams
            if (data.right.type == 'bnpp_equipe') {
                const habilitations = await pool.query(sql_reqs['get_equipe_members'], [req.params.id])
                data.habilitations = habilitations.rows
            } else if (data.right.type == 'business') {
                const liste_droits = await pool.query(sql_reqs['get_liste_droits'], [req.params.id])
                data.liste_droits = liste_droits.rows
            }
            res.json(data)
        } else {
            res.status(404).end()
        }
    } catch (err) {
        logs('/api/rights/' + req.params.id, err)
        res.status(500).end()
    }
})

// SSO CODE
app.get('/api/sso/:code', (req, res) => {
    const code = req.params.code
    const config = {
        method: 'post',
        url: sm.siteminderLink + 'token',
        data: qs.stringify({
            'grant_type': 'authorization_code',
            'client_id': sm.client_id,
            'client_secret': sm.client_secret,
            'code': code
        }),
        httpsAgent
    }
    axios(config).then(function(response) {
        res.json(response.data)
    })
    .catch(function(err) {
        logs('/api/sso/' + req.params.code, err)
        res.status(500).end()
    })
})

// SSO GET USER INFO
app.get('/api/sso/userinfo/:access_token', async(req, res) => {
    const access_token = req.params.access_token
    const userInfo = await getUserInfo(access_token)

    userInfo.data.isSCE09 = (await isSCE09(userInfo.data.sub)).toString()
    userInfo.data.cellule_locale = (await get_my_cellules_locales_poles_list(userInfo.data.sub)).length > 0
    userInfo.data.cellule_centrale = (await pool.query(sql_reqs['cellule_centrale_check'], [userInfo.data.sub])).rows[0].res != '0'

    userInfo.data.shouldShowRequestsPage = await shouldShowRequestsPage(userInfo.data.sub)
    userInfo.data.shouldShowhabilitationsPage = await shouldShowhabilitationsPage(userInfo.data.sub)
    userInfo.data.shouldShowRightsExtractionPage = await shouldShowRightsExtractionPage(userInfo.data.sub)
    userInfo.data.shouldShowAssetsPage = await shouldShowAssetsPage(userInfo.data.sub)
    res.status(userInfo.status).json(userInfo.data)
})

// Refresh SSO
app.get('/api/sso/refresh/:refresh_token', (req, res) => {
    const options = {
        method: 'POST',
        url: sm.siteminderLink + 'token',
        data: qs.stringify({
            'grant_type': 'refresh_token',
            'client_id': sm.client_id,
            'client_secret': sm.client_secret,
            'refresh_token': req.params.refresh_token
        }),
        httpsAgent
    }
    axios(options)
        .then(function(response) {
            res.json(response.data)
        })
        .catch(function(err) {
            logs('/api/sso/refresh/' + req.params.refresh_token, err)
            res.status(500).end()
        })
})

// CHECK TOKEN BEFORE ALL REQUESTS EXCEPT SSO
app.use(async(req, res, next) => {
    if (res.writableEnded) {
        return
    }
    
    const token = req.headers.authorization
    const userInfo = await getUserInfo(token)

    if (userInfo.status != 200) {
        res.status(401).json('Unauthorized or token expired')
    } else {
        res.locals.userInfo = userInfo.data;
        /* si simulation de tout type */
        // res.locals.userInfo.sub = '0000000'
        next()
    }
})


/* ENDPOINT GET : les KPI droits */
app.get('/api/kpisod', async(req, res) => {
    try {
        // check if the user is in SCE09
        // if (!(await isSCE09(res.locals.userInfo.sub))) {
        //     res.status(403).end()
        // } else {
            const kpi = {
                //rollingMonths: getCurrentRollingMonths(false),
                //rightsCount: (await pool.query(sql_reqs['right_count'])).rows[0],
               // rightCountByMonth: (await pool.query(sql_reqs['right_count_by_month'])).rows,
                rightsCountByEntity: (await pool.query(sql_reqs['kpisod'])).rows,
                numberOfSODRules: (await pool.query(sql_reqs['numberOfSODRules'])).rows,
                //rightsActions: (await pool.query(sql_reqs['rights_actions'])).rows
            }
            res.json(kpi)
        // }
    } catch (err) {
        logs('/api/kpi', err)
        res.status(500).end()
    }
})

/* ENDPOINT GET : les KPI droits */
app.get('/api/kpi', async(_req, res) => {
    try {
        // check if the user is in SCE09
        if (!(await isSCE09(res.locals.userInfo.sub))) {
            res.status(403).end()
        } else {
            const kpi = {
                rollingMonths: getCurrentRollingMonths(false),
                rightsCount: (await pool.query(sql_reqs['right_count'])).rows[0],
                rightCountByMonth: (await pool.query(sql_reqs['right_count_by_month'])).rows,
                rightsCountByEntity: (await pool.query(sql_reqs['rights_count_by_entity'])).rows,
                rightsActions: (await pool.query(sql_reqs['rights_actions'])).rows
            }
            res.json(kpi)
        }
    } catch (err) {
        logs('/api/kpi', err)
        res.status(500).end()
    }
})




/* ENDPOINT GET : les KPI sur les demandes d’habilitation */
app.get('/api/kpi_requests', async(_req, res) => {
    try {
        // check if the user is in SCE09
        if (!(await isSCE09(res.locals.userInfo.sub))) {
            res.status(403).end()
        } else {
            const rollingMonths = getCurrentRollingMonths()
            const kpi_requests = {
                rollingMonths: rollingMonths,
                total: (await pool.query(sql_reqs['requests_total'])).rows[0],
                topTen: (await pool.query(sql_reqs['requests_top_ten'])).rows,
                requestsByEntity: (await pool.query(sql_reqs['requests_by_entity'])).rows,
                requestsCountByMonthAndEntity: (await pool.query(sql_reqs['requests_count_by_month_and_entity'], 
                    [rollingMonths])).rows
            }
            res.json(kpi_requests)
        }
    } catch (err) {
        logs('/api/kpi_requests', err)
        res.status(500).end()
    }
})

/* ENDPOINT GET : que peut demander l'utilisateur connecté sur les demandes d'habilitation, 
et extraction de droits personnalisée */
app.get('/api/requests_options', async(_req, res) => {
    const eid = res.locals.userInfo.sub
    const ret = await getRequestsOptions(eid)
    res.status(ret.status).json(ret.options)
})
app.get('/api/requests_optionsv2', async(_req, res) => {
    const eid = res.locals.userInfo.sub
    const ret = await getRequestsOptions2(eid)
    res.status(ret.status).json(ret.options)
})

app.get('/api/requests_optionsv3', async(_req, res) => {
    const eid = res.locals.userInfo.sub
    const ret = await getRequestsOptions3(eid)
    res.status(ret.status).json(ret.options)
})

app.get('/api/requests_optionsv4', async(_req, res) => {
    const eid = res.locals.userInfo.sub
    const ret = await getRequestsOptions4(eid)
    res.status(ret.status).json(ret.options)
})


//pour transformer les valeurs de la colonne type de droit
function transformTypeDroit(type_droit) {

    if("droit".includes((type_droit).toLowerCase())){
        type_droit = "it";
    } else if("equipe".includes((type_droit).toLowerCase())){
        type_droit = "bnpp_equipe";
    } else if("profil metier".includes((type_droit).toLowerCase())){
        type_droit = "business";
    }
    return type_droit;
}


async function getDataByFilter(option, res, type, offset = null, limit = null, bodyFilter = {}, dateStart = null, dateEnd = null) {
    // eid user
    const eid = res.locals.userInfo.sub;
    let name1 = (await pool.query(sql_reqs['name1'], [eid])).rows.map(e => e.display_name)
    name1 = name1[0]

    // by default nothing is allowed for security reasons
    let filter = [];

    //body filter is empty ?
    const bodyFilterEmpty = Object.keys(bodyFilter).length === 0

    // by default is true for security reasons
    let needFilter = true;

    // on recupere toutes les habilitations de l'user connecté
    const habi = (await pool.query(sql_reqs['user_habi'], [eid])).rows.map(e => e.code_unique)

    // maintenant que veut l'utilisateur ?

    let ret, ret2, retC1, retC12, retTotalCount, query, prequery;

    if (option == '3' || option == '5') {
        let t1, t2;
        if (option == '3') {
            t1 = 'secu_filter'
            t2 = 'habilitations_all_secu'
        } else {
            t1 = 'manager_filter'
            t2 = 'habilitations_all_manager'
        }
        if (type == 'requests') {
            prequery = knex.with('tmp', knex.raw(sql_reqs[t1], [dateStart, dateEnd, eid])).select().from('tmp')
            retTotalCount = knex.with('tmp', knex.raw(sql_reqs[t1], [dateStart, dateEnd, eid])).count().from('tmp')
        } else if (type == 'habilitations') {
            query = knex.with('tmp', knex.raw(sql_reqs[t2], [eid])).select().from('tmp')
            retTotalCount = knex.with('tmp', knex.raw(sql_reqs[t2], [eid])).count().from('tmp')
        } 
        else if (type == 'tasks') {
            query = knex.with('tmp', knex.raw(sql_reqs[t1], [dateStart, dateEnd, eid])).select().from('tmp')
            retTotalCount = knex.with('tmp', knex.raw(sql_reqs[t1], [dateStart, dateEnd, eid])).count().from('tmp')
        }
        if (!bodyFilterEmpty) {
            query = query.clone()
            Object.keys(bodyFilter).forEach(function(e) {
                query = query.whereILike(e, '%' + bodyFilter[e] + '%')
            })
            retTotalCount = retTotalCount.clone()
            Object.keys(bodyFilter).forEach(function(e) {
                retTotalCount = retTotalCount.whereILike(e, '%' + bodyFilter[e] + '%')
            })
        }
        if (offset != null && limit != null) {
            ret = await query.offset(offset).limit(limit)
        } else {
            ret = await query
        }
        return {
            'objects': ret,
            'count': await retTotalCount
        }
    }

    if (option == '1') {
            // si proprio
    filter = (await pool.query(sql_reqs['proprio_filter'], [habi])).rows.map(e => e.code_unique)
} else if (option == '2' && type != 'habilitations') {
    // si valideur
    filter = (await pool.query(sql_reqs['valideur_filter'], [habi])).rows.map(e => e.code_unique)
} else if (option == '4' && type != 'habilitations') {
    // si imp
    filter = (await pool.query(sql_reqs['imp_filter'], [habi])).rows.map(e => e.code_unique)
} else if (option == '6') {
    // si cellule_locale
    if(type == 'habilitations'){
        filter = (await pool.query(sql_reqs['cellule_locale_filter_optionCL'], [eid])).rows.map( e => e.code_unique)
    } 
    else {
        filter = (await pool.query(sql_reqs['cellule_locale_filter'], [habi])).rows.map(e => e.code_unique)
    }
} else if (option == '7') {
    // si cellule_centrale
    const cellule_centrale = (await pool.query(sql_reqs['cellule_centrale_or_csirt_filter'], ['ITG_MyAccess_Administrateur central', eid])).rows[0].res != '0';
    // si vraiment cellule centrale alors on by pass le filter
    if (cellule_centrale === true) {
        needFilter = false
    }
} else if (option == '8') {
    // si csirt
    //const csirt = (await pool.query(sql_reqs['cellule_centrale_or_csirt_filter2'], ['BNPP Droit transverse', eid])).rows[0].res != '0';
    //MODIFICATION CSIRT
        const csirt = (await pool.query(sql_reqs['cellule_centrale_or_csirt_filter2'], [eid])).rows[0].res != '0';

    // si vraiment csirt alors on by pass le filter
    if (csirt === true) {
        needFilter = false
    }
}

    if (filter.length === 0 && needFilter === true) {
        return {
            'objects': [],
            'count': 0
        }
    }



    if((type == 'tasks') || (type == 'habilitations' && option == '8') || (type == 'requests' && option == '8')
    || (type == 'habilitations' && option == '7') || (type == 'requests' && option == '7') ||
    (type == 'requests' && option == '4') || (type == 'requests' && option == '1') ||
    (type == 'requests' && option == '2') || (type == 'requests' && option == '6') ||
    (type == 'habilitations' && option == '1') ||
    (type == 'convergenceasset' && option == '7') || (type == 'convergencedroit' && option == '7') ||
    (type == 'convergencehabilitation' && option == '7') || (type == 'convergencemanager' && option == '7')) {
        if (type == 'requests' && option == '2'){
        // OK mais à creuser
        if (offset != null && limit != null) {

            retC1 = knex('requests').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
                this.whereIn('right_id', filter).orWhere('valideur_1', name1).orWhere('valideur_2', name1).
                orWhere('valideur_3', name1).orWhere('valideur_4', name1)
            }).andWhere('action', 'Add').limit(limit).offset(offset)
            retC12 = knex('requests').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
                this.whereIn('right_id', filter).orWhere('valideur_1', name1).orWhere('valideur_2', name1).
                orWhere('valideur_3', name1).orWhere('valideur_4', name1)
            }).andWhere('action', 'Add')

        } else {

            retC1 = knex('requests').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
                this.whereIn('right_id', filter).orWhere('valideur_1', name1).orWhere('valideur_2', name1)
                .orWhere('valideur_3', name1).orWhere('valideur_4', name1)
            }).andWhere('action', 'Add')
            retC12 = knex('requests').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
                this.whereIn('right_id', filter).orWhere('valideur_1', name1).orWhere('valideur_2', name1)
                .orWhere('valideur_3', name1).orWhere('valideur_4', name1)
            }).andWhere('action', 'Add')
        }
    } 
    else if(type == 'requests' && option == '6') {
        //OK
        const listepb1 = []
        const reqOpt6 = (await pool.query(sql_reqs['requestsOptionSix'], [habi])).rows
        for (let pb1 = 0; pb1 < reqOpt6[0].poles.length; pb1++) {
            listepb1[pb1] = reqOpt6[0].poles[pb1]
        }
    
        const reqOpt6ListeDesBenef = (await pool.query(sql_reqs['requestsOptionSixListeDesBenef'],
            [listepb1])).rows.map(e => e.display_name)
    
        // const reqOpt6ListeDesBenef = (await pool.query(sql_reqs['requestsOptionSixListeDesBenef'],
        //     [reqOpt6[0].poles[0]])).rows.map(e => e.display_name)
    
        if (offset != null && limit != null) {



            retC1 = knex('requests').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
                this.whereIn('right_id', filter).orWhereIn('beneficiaire', reqOpt6ListeDesBenef)
            }).limit(limit).offset(offset)
            retC12 = knex('requests').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
                this.whereIn('right_id', filter).orWhereIn('beneficiaire', reqOpt6ListeDesBenef)
            })
        } else {
            retC1 = knex('requests').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
                this.whereIn('right_id', filter).orWhereIn('beneficiaire', reqOpt6ListeDesBenef)
            })
            retC12 = knex('requests').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
                this.whereIn('right_id', filter).orWhereIn('beneficiaire', reqOpt6ListeDesBenef)
            })
        }


    
    } 
    else if(type == 'habilitations' && option == '6') {
        const listepb1 = []
        const reqOpt6 = (await pool.query(sql_reqs['requestsOptionSix'], [habi])).rows
        for (let pb1 = 0; pb1 < reqOpt6[0].poles.length; pb1++) {
            listepb1[pb1] = reqOpt6[0].poles[pb1];
        }            


        if (offset != null && limit != null) {
            retC1 = knex('rapporthabilitation_viewcl').andWhere(function(){
                this.whereIn('cellule_locale_gestionnaire_id', filter).orWhereIn('pole', listepb1)
            }).limit(limit).offset(offset)
            retC12 = knex('rapporthabilitation_viewcl').andWhere(function(){
                this.whereIn('cellule_locale_gestionnaire_id', filter).orWhereIn('pole', listepb1)
            })


        } else {
            retC1 = knex('rapporthabilitation_viewcl').andWhere(function(){
                this.whereIn('cellule_locale_gestionnaire_id', filter).orWhereIn('pole', listepb1)
            })
            retC12 = knex('rapporthabilitation_viewcl').andWhere(function(){
                this.whereIn('cellule_locale_gestionnaire_id', filter).orWhereIn('pole', listepb1)
            })
        }
    } 
    else if(type == 'habilitations' && option == '1') {
    
        if (offset != null && limit != null) {

            retC1 = knex('rapporthabilitation_view').whereIn('code_du_droit', filter).limit(limit).offset(offset)
            retC12 = knex('rapporthabilitation_view').whereIn('code_du_droit', filter)

        } else {

            retC1 = knex('rapporthabilitation_view').whereIn('code_du_droit', filter)
            retC12 = knex('rapporthabilitation_view').whereIn('code_du_droit', filter)

        }
    }
else if(type == 'requests' && option == '1') {

    if (offset != null && limit != null) {

        retC1 = knex('requests').whereIn('right_id', filter).andWhereBetween('date_soumission',
            [dateStart, dateEnd]).limit(limit).offset(offset)
        retC12 = knex('requests').whereIn('right_id', filter).andWhereBetween('date_soumission',
            [dateStart, dateEnd])


    } else {

        retC1 = knex('requests').whereIn('right_id', filter).andWhereBetween('date_soumission',
            [dateStart, dateEnd])
        retC12 = knex('requests').whereIn('right_id', filter).andWhereBetween('date_soumission',
            [dateStart, dateEnd])

    }
} 
else if(type == 'requests' && option == '4') {

    if (offset != null && limit != null) {

        retC1 = knex('requests').whereIn('right_id', filter).andWhereBetween('date_soumission',
            [dateStart, dateEnd]).limit(limit).offset(offset)
        retC12 = knex('requests').whereIn('right_id', filter).andWhereBetween('date_soumission',
            [dateStart, dateEnd])

    } else {

        retC1 = knex('requests').whereIn('right_id', filter).andWhereBetween('date_soumission',
            [dateStart, dateEnd])
        retC12 = knex('requests').whereIn('right_id', filter).andWhereBetween('date_soumission',
            [dateStart, dateEnd])
    }
}
 else if(type == 'requests' && option == '7') {

    if (offset != null && limit != null) {

        retC1 = knex('requests').andWhereBetween('date_soumission', [dateStart, dateEnd]).limit(limit).offset(offset)
        retC12 = knex('requests').andWhereBetween('date_soumission', [dateStart, dateEnd])

    } else {

        retC1 = knex('requests').andWhereBetween('date_soumission', [dateStart, dateEnd])
        retC12 = knex('requests').andWhereBetween('date_soumission', [dateStart, dateEnd])

    }
} 
else if(type == 'habilitations' && option == '7' || type == 'habilitations' && option == '8') {

    if (offset != null && limit != null) {

        retC1 = knex('rapporthabilitation_view').limit(limit).offset(offset)
        retC12 = knex('rapporthabilitation_view')

    } else {

        retC1 = knex('rapporthabilitation_view')
        retC12 = knex('rapporthabilitation_view')

    }
}
 else if(type == 'requests' && option == '8') {

    if (offset != null && limit != null) {

        retC1  = knex('requests').andWhereBetween('date_soumission', [dateStart, dateEnd]).limit(limit).offset(offset)
        retC12 = knex('requests').andWhereBetween('date_soumission', [dateStart, dateEnd])

    } else {

        retC1  = knex('requests').andWhereBetween('date_soumission', [dateStart, dateEnd])
        retC12 = knex('requests').andWhereBetween('date_soumission', [dateStart, dateEnd])

    }
} 
else if(type == 'tasks' && option == '7') {

    if (offset != null && limit != null) {

        retC1  = knex('tasks').andWhereBetween('date_soumission', [dateStart, dateEnd]).limit(limit).offset(offset)
        retC12 = knex('tasks').andWhereBetween('date_soumission', [dateStart, dateEnd])

    } else {

        retC1  = knex('tasks').andWhereBetween('date_soumission', [dateStart, dateEnd])
        retC12 = knex('tasks').andWhereBetween('date_soumission', [dateStart, dateEnd])
    }
}
 else if(type == 'tasks' && option == '6') {

    const listepb1 = []
    const reqOpt6  = (await pool.query(sql_reqs['requestsOptionSix'], [habi])).rows
    for (let pb1 = 0 ; pb1 < reqOpt6[0].poles.length; pb1++) {
        listepb1[pb1] = reqOpt6[0].poles[pb1];
    }
    const reqOpt6ListeDesBenef = (await pool.query(sql_reqs['requestsOptionSixListeDesBenef2'],
        [listepb1])).rows.map(e => e.eid)


    if (offset != null && limit != null) {

        retC1  = knex('tasks').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
            this.whereIn('right_id', filter).orWhereIn('beneficiaire', reqOpt6ListeDesBenef)
        }).limit(limit).offset(offset)
        retC12 = knex('tasks').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
            this.whereIn('right_id', filter).orWhereIn('beneficiaire', reqOpt6ListeDesBenef)
        })

    } else {

        retC1  = knex('tasks').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
            this.whereIn('right_id', filter).orWhereIn('beneficiaire', reqOpt6ListeDesBenef)
        })
        retC12 = knex('tasks').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
            this.whereIn('right_id', filter).orWhereIn('beneficiaire', reqOpt6ListeDesBenef)
        })
    }
}
else if(type == 'tasks' && option == '4') {

    if (offset != null && limit != null) {

        retC1  = knex('tasks').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
            this.whereIn('right_id', filter).orWhere('implementeur', name1)
        }).limit(limit).offset(offset)
        retC12 = knex('tasks').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
            this.whereIn('right_id', filter).orWhere('implementeur', name1)
        })

    } else {

        retC1  = knex('tasks').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
            this.whereIn('right_id', filter).orWhere('implementeur', name1)
        })
        retC12 = knex('tasks').whereBetween('date_soumission', [dateStart, dateEnd]).andWhere(function(){
            this.whereIn('right_id', filter).orWhere('implementeur', name1)
        })
    }
}
 else if(type == 'convergenceasset' && option == '7') {

    if (offset != null && limit != null) {

        retC1  = knex('convergenceasset').limit(limit).offset(offset)
        retC12 = knex('convergenceasset')

    } else {

        retC1  = knex('convergenceasset')
        retC12 = knex('convergenceasset')
    }
}
else if(type == 'convergencedroit' && option == '7') {

    if (offset != null && limit != null) {

        retC1  = knex('convergencedroit').limit(limit).offset(offset)
        retC12 = knex('convergencedroit')

    } else {

        retC1  = knex('convergencedroit')
        retC12 = knex('convergencedroit')
    }
}
 else if(type == 'convergencehabilitation' && option == '7') {

    if (offset != null && limit != null) {

        retC1  = knex('rapporthabilitation_myrecert').limit(limit).offset(offset)
        retC12 = knex('rapporthabilitation_myrecert')

    } else {

        retC1  = knex('rapporthabilitation_myrecert')
        retC12 = knex('rapporthabilitation_myrecert')
    }
}
 else if(type == 'convergencemanager' && option == '7') {

    if (offset != null && limit != null) {

        retC1  = knex('convergencemanager').limit(limit).offset(offset)
        retC12 = knex('convergencemanager')

    } else {

        retC1  = knex('convergencemanager')
        retC12 = knex('convergencemanager')
    }
}

if (!bodyFilterEmpty) {
    Object.keys(bodyFilter).forEach(function(e) {
        if (e == 'id') {
            ret  = retC1.whereRaw('CAST(' + e + ' AS TEXT)' + ' LIKE ?', '%' + bodyFilter[e] + '%')
            ret2 = retC2.whereRaw('CAST(' + e + ' AS TEXT)' + ' LIKE ?', '%' + bodyFilter[e] + '%')
        } else {
            ret  = retC1.whereILike(e, '%' + bodyFilter[e] + '%')
            ret2 = retC2.whereILike(e, '%' + bodyFilter[e] + '%')
        }
    })

} 
else {
    ret  = retC1
    ret2 = retC12
}

if(type == 'requests'){
    return {
        'objects': (await ret.clone()
        .select('id', 'request_id', 'demandeur', 'beneficiaire', 'code_iso_beneficiaire', 'action', 'asset', 'asset_id', 'right_id',
                'date_soumission', 'statut', 'date_fin', 'equipe_implementeur', 'implementeur', 'libelle_droit', 'type_droit',
                'date_soumission_valideur_2', 'date_decision_valideur_2', 'valideur_3', 'date_soumission_valideur_3',
                'date_decision_valideur_3', 'valideur_4', 'date_soumission_valideur_4', 'date_decision_valideur_4',
                'equipe_implementeur', 'implementeur', 'date_soumission_implementeur', 'date_decision_implementeur',
                'implementeur_bis_legacy', 'date_soumission_implementeur_bis_legacy', 'date_decision_implementeur_bis_legacy',
                'date_fin_habilitation', 'perimetre_01', 'perimetre_02', 'perimetre_03', 'perimetre_04', 'perimetre_05',
                'perimetre_06', 'perimetre_07', 'perimetre_08', 'perimetre_09', 'perimetre_10', 'commentaire',
                'droits_contenus_dans_profil_metier', 'code_unique_pm_du_droit', 'libelle_pm_du_droit').orderBy('id', 'asc')),



    'count': (await ret2.clone().count())
}
}
 else if(type == 'habilitations'){

return {
    'objects': (await ret.clone()
        .select('uid', 'beneficiaire', 'code_iso', 'responsable_de_l_uo', 'code_uo', 'uo', 'pole', 'metier',
                'statut_utilisateur', 'sensibilite_du_droit', 'statut_droit', 'start_date', 'end_date', 'code_du_droit',
                'libelle_droit', 'type_droit', 'description_fr', 'description_en', 'asset', 'perimetre_01',
                'perimetre_02', 'perimetre_03', 'perimetre_04', 'perimetre_05', 'perimetre_06', 'perimetre_07',
                'perimetre_08', 'perimetre_09', 'perimetre_10', 'droits_contenus_dans_profil_metier',
                'code_de_l_appli', 'code_unique_pm_du_droit', 'libelle_pm_du_droit')),

    'count': (await ret2.clone().count())
}
} 
else if(type == 'tasks') {
    return {
        'objects': (await ret.clone()
        .select('id_tache', 'request_id', 'demandeur', 'beneficiaire', 'action', 'asset', 'asset_id', 'right_id',
                'libelle_droit', 'type_droit', 'date_soumission', 'statut', 'date_fin', 'equipe_implementeur',
                'implementeur', 'date_soumission_implementeur', 'date_action_implementeur', 'perimetre_01',
                'perimetre_02', 'perimetre_03', 'perimetre_04', 'perimetre_05', 'perimetre_06', 'perimetre_07',
                'perimetre_08', 'perimetre_09', 'perimetre_10', 'commentaire').orderBy('id_tache', 'asc')),

    'count': (await ret2.clone().count())
}

}
 else if(type == 'convergenceasset'){


return {
    'objects': (await ret.clone()
        .select('ApplicationName', 'ApplicationOwnerUID', 'ApplicationDescription')),

    'count': (await ret2.clone().count())
}
} 
else if(type == 'convergencedroit'){

return {
    'objects': (await ret.clone()
        .select('ApplicationName', 'EntitlementName', 'EntitlementValue', 'EntitlementDisplayName',
                'EntitlementOwner', 'EntitlementDescription')),

    'count': (await ret2.clone().count())
}
}
 else if(type == 'convergencehabilitation'){

    return {
        'objects': (await ret.clone()
            .select('beneficiary_uid', 'beneficiary_display_name', 'beneficiary_firstname', 'beneficiary_lastname',
                    'beneficiary_email', 'unit_manager_uid', 'unit_manager_display_name', 'unit_manager_firstname',
                    'unit_manager_lastname', 'unit_manager_email', 'certifier_uid', 'certifier_display_name',
                    'certifier_firstname', 'certifier_lastname', 'certifier_email', 'code_uo', 'uo', 'pole', 'metier',
                    'statut_utilisateur', 'sensibilite_du_droit', 'statut_droit', 'start_date', 'end_date',
                    'right_display_name', 'code_du_droit', 'libelle_droit', 'type_droit', 'description_fr',
                    'description_en', 'asset', 'source', 'all_perimetre', 'perimetre_01', 'perimetre_02',
                    'perimetre_03', 'perimetre_04', 'perimetre_05', 'perimetre_06', 'perimetre_07', 'perimetre_08',
                    'perimetre_09', 'perimetre_10', 'droits_contenus_dans_profil_metier', 'code_de_l_appli')),
                    
        'count': (await ret2.clone().count())
    }
  }
 else if(type == 'convergencemanager'){

    return {
        'objects': (await ret.clone()
            .select('username', 'userdisplayname', 'firstname', 'lastname', 'email', 'uid', 'usermanageruid')),


        'count': (await ret2.clone().count())
    }
  }

 }
}


        




    
/* ENDPOINT GET : les demandes de rapports */

async function statistic(type, res) {

    try {
        // firstly, get identity by eid
        let uid = res.locals.userInfo.sub
        //let uid = "fl1085"
        const cellule_centrale = (await pool.query(sql_reqs['cellule_centrale_check'], [uid])).rows[0].res != '0';
        let isSec09 = await isSEC09(res.locals.userInfo.sub);
        if (cellule_centrale || isSec09) {

            const ret = {}

            if (type == "statistic")
                ret['statistic'] = (await pool.query(sql_reqs['get_statistic'])).rows
            else
                ret['statistic'] = (await pool.query(sql_reqs['get_statistic_view'])).rows
            res.json(ret)
        } else {
            res.status(401).end()
        }

    } catch (err) {
        logs('/api/statistic/', err)
        res.status(500).end()
    }   


};


/* ENDPOINT GET : les demandes de rapports */

app.get('/api/statistic', async(_req, res) => {
    statistic('statistic', res)
})

/* ENDPOINT GET : les demandes de rapport généré */
app.get('/api/statistic_view', async(_req, res) => {
    statistic('statistic_view', res)

})


/* ENDPOINT GET : les demandes de  pole de certif */

app.get('/api/date/', async(_req, res) => {
    try {
        const body1 = res.locals.userInfo.sub
        // const body1 = _req.body.uid
        const ret = {}
        let date_annee;
        const cellule_centrale = (await pool.query(sql_reqs['cellule_centrale_check'], [body1])).rows[0].res != '0';

        if (cellule_centrale) {
            date_annee = (await pool.query(sql_reqs['get_date_centrale'])).rows
            ret['cellule_centrale'] = true
            ret['pole'] = []
        } else {
            let pole = await get_cellule_local_poles(body1)
            console.log(pole)
            date_annee = (await pool.query(sql_reqs['get_date'], [pole])).rows
            ret['cellule_centrale'] = false
            ret['pole'] = pole
        }
        ret['date_annee'] = date_annee
        res.json(ret)
    } catch (err) {
        logs('/api/date/', err)
        res.status(500).end()
    }
})


/* ENDPOINT GET : les demandes de  pole de certif */

app.get('/api/date2/', async(_req, res) => {
    try {
        const body1 = res.locals.userInfo.sub
        // const body1 = _req.body.uid
        const ret = {}
        let date_annee
        const cellule_centrale = (await pool.query(sql_reqs['cellule_centrale_check'], [body1])).rows[0].res != '0';

        if (cellule_centrale) {
            date_annee = (await pool.query(sql_reqs['get_date_centrale'])).rows
            ret['cellule_centrale'] = true
        }
        ret['date_annee'] = date_annee
        res.json(ret)
    } catch (err) {
        logs('/api/date/', err)
        res.status(500).end()
    }
})

/* ENDPOINT GET : les demandes de certif */
// la liste des compagnes de certification qui correspond à l'année choisie sur le premier ecran de l’avancement
app.get('/api/certification_avancement/:selectedDate', async(_req, res) => {
    const date = _req.params.selectedDate
    try {
        const body1 = res.locals.userInfo.sub
        // const body1 = _req.body.uid

        if (date != "a") {
            const cellule_centrale = (await pool.query(sql_reqs['cellule_centrale_check'], [body1])).rows[0].res != '0';

            let certification_choisi;
            if (cellule_centrale) {
                certification_choisi = (await pool.query(sql_reqs['get_certification_local'], [date])).rows
            } else {
                let pole = await get_cellule_local_poles(body1)
                certification_choisi = (await pool.query(sql_reqs['get_certification'], [date, pole])).rows
            }
            res.json(certification_choisi)
        }
    } catch (err) {
        logs('/api/certification_avancement/', err)
        res.status(500).end()
    }
})


// la liste des compagnes de certification qui correspond a l'année choisie sur le deuxième ecran de l'avancement
app.get('/api/certification_avancement2/:selectedDate', async(_req, res) => {
    
    try {
        if (date != "a") {
            const cellule_centrale = (await pool.query(sql_reqs['cellule_centrale_check'], [body1])).rows[0].res != '0';

            let certification_choisi;
            if (cellule_centrale) {
                certification_choisi = (await pool.query(sql_reqs['get_certification_local'], [date])).rows
            }
            res.json(certification_choisi)
        }

    } catch (err) {
        logs('/api/certification_avancement/', err)
        res.status(500).end()
    }
})

// La liste des uo  dont l'utilisateur est cellule centrale
async function cellule_centrale_certif(certification) {
    let droits = 'true'
    let send = await get_uo(certification, null, droits)

    return send
}

// La liste des uo  par cellule gestionnaire de droit
async function cellule_centrale_certif2(certification, cellule_gestionnaire) {
    let send = await get_uo(certification, null, cellule_gestionnaire)
    return send 
}









// cette fonction retourne les poles dont l'utilisateur est cellule locale
async function get_cellule_local_poles(eid) {

    const liste1 = []
    const liste3 = []
    let i = 0

    const ret3 = (await pool.query(sql_reqs['v3ListeCL'])).rows
    for (i; i < ret3.length; i++) {
        liste1[i] = ret3[i].code_unique;
    }
    liste1[ret3.length] = "ITG_MyAccess_Administrateur central";

    const codeUniqueDesCLAuxquelIlAppartient = (await pool.query(sql_reqs['v3_si_cl_ou_non'], [eid, liste1])).rows
    for (let k = 0; k < codeUniqueDesCLAuxquelIlAppartient.length; k++) {
        liste3[k] = codeUniqueDesCLAuxquelIlAppartient[k].code_unique;
    }

    if (liste3.includes("ITG_MyAccess_Administrateur central")) {
        liste3[0] = "ITG_MyAccess_Administrateur central"
    }

    let cellule_gest_name = ((await pool.query(sql_reqs['get_cellule_gest_name'], [liste3[0]])).rows).
    map(obj => obj.libelle)

    return cellule_gest_name[0]
}



/* ENDPOINT GET : les demandes de certif */
/* La liste des uo du certif choisie sur le premier ecran */
app.post('/api/case1', async(req, res) => {
    try {
        const body1 = res.locals.userInfo.sub;
        // const body1 = req.body.uid

        const certif = req.body.selectedCertif;
        const cellule_centrale = (await pool.query(sql_reqs['cellule_centrale_check'], [body1])).rows[0].res
            != '0';
        let arbo;
        if (cellule_centrale) {
            arbo = await cellule_centrale_certif(certif)
        } else {
            let pole_1 = await get_cellule_local_poles(body1)
            arbo = await get_uo(certif, null, pole_1)
        }
        res.json(arbo)
    } catch (err) {
        logs('/api/case1', err)
        res.status(500).end()
    }
})









// cette fonction retourne les droits dont l'utilisateur est cellule locale
async function get_cellule_name(eid) {
    let droits_get = []
    let droits = (await pool.query(sql_reqs['get_right_by_eid'], [eid])).rows

    for (let i = 0; i < droits.length; i++)
        droits_get[i] = droits[i].code_unique

    let ret_cell2 = ((await pool.query(sql_reqs['get_cellule2'], [droits_get])).rows)

    let cellule_name = []
    for (let agh = 0; agh < ret_cell2.length; agh++)
        cellule_name[agh] = ret_cell2[agh].libelle
    return cellule_name
}

async function get_cellule_pole_droit(cellule_name, certification) {
    let my_lib;
    if (certification) {
        my_lib = (await pool.query(sql_reqs['get_cellule_name_from_droit'], [cellule_name, certification])).rows
    }
    else {
        my_lib = (await pool.query(sql_reqs['get_cellule_name_from_droit2'], [cellule_name])).rows
    }

    let cellule_name_pole = []
    for (let i = 0; i < my_lib.length; i++)
        cellule_name_pole[i] = my_lib[i].pole_du_beneficiaire

    return cellule_name_pole
}



/* ENDPOINT GET : les demandes de  certif */
app.post('/api/pole', async(req, res) => {
    try {
        const body1 = res.locals.userInfo.sub
        const ret = {}
        const selectedCertif = req.body.selectedCertif;
        const cellule_centrale = (await pool.query(sql_reqs['cellule_centrale_check'], [body1])).rows[0].res 
        != '0';

        if (selectedCertif != "a") {
            let cellule_pole, cellule_name;
            if (cellule_centrale) {
                cellule_pole = (await pool.query(sql_reqs['get_pole_cellule_centrale'], [selectedCertif])).rows
            } else {
                cellule_name = await get_cellule_name(body1)
                cellule_pole = await get_cellule_pole_droit(cellule_name, selectedCertif)
            }

            ret['pole_ma_cellule'] = cellule_pole
            ret['droits_ma_cellule'] = cellule_name
        }

        res.json(ret)
    } catch (err) {
        logs('/api/pole/', err)
        res.status(500).end()
    }
})





// La liste des uo du certif choisie sur le deuxième ecran
app.post('/api/case2_cellule_centrale', async(req, res) => {
    try {

        const certif = req.body.selectedCertif;

        const pole_de_code = (await pool.query(sql_reqs['get_poles_from_cellule_when_centrale'], [certif])).rows
        res.json(pole_de_code)

    } catch (err) {
        logs('/api/case2_cellule_centrale/', err)
        res.status(500).end()
    }
})

// La liste des uo du certif choisie, et de la cellule gestionnaire de droit sur le deuxième ecran
app.post('/api/case2', async(req, res) => {
    try {
        const body1 = res.locals.userInfo.sub
        // const body1 = req.body.uid
        const cellule_centrale = (await pool.query(sql_reqs['cellule_centrale_check'], [body1])).rows[0].res != '0';
        const certif = req.body.selectedCertif;
        const cellule_gestionnaire_droit = req.body.selectedPole2;

        let send;
        if (cellule_centrale) {
            send = await cellule_centrale_certif2(certif, cellule_gestionnaire_droit)
        }
        res.json(send)
    } catch (err) {
        logs('/api/case2/', err)
        res.status(500).end()
    }
})


// fonction pour récupérer la liste des uo
async function get_uo(certif, pole, droits_code2) {
    let ret_dict;
    if (droits_code2 == 'true') {
        let test = (await pool.query(sql_reqs['testv0'], [certif])).rows
        ret_dict = JSON.parse(test[0].dict)
    }

    if (droits_code2.length == 0 || (droits_code2 != 'true' && droits_code2.length != 0)) {
        let result = (await pool.query(sql_reqs['testv9'], [certif, droits_code2])).rows
        ret_dict = JSON.parse(result[0].dict)
    }

    return ret_dict
}

/* ENDPOINT GET : les demandes d’habilitation */
app.post('/api/requests/:option/:dateStart/:dateEnd/:offset/:limit', async(req, res) => {
    try {
        if(req.body.type_droit)
            req.body.type_droit = transformTypeDroit(req.body.type_droit)
        const offsetLimit = formatOffsetLimit(req.params.offset, req.params.limit)
        const ret = await getDataByFilter(req.params.option, res, 'requests', offsetLimit[0], offsetLimit[1], 
                            req.body, req.params.dateStart, req.params.dateEnd)
        res.json(ret)
    } catch (err) {
        logs('/api/requests/', err)
        res.status(500).end()
    }
})
app.post('/api/requests/:option/:dateStart/:dateEnd/toExcel', async(req, res) => {
    try {
        if(req.body.type_droit)
            req.body.type_droit = transformTypeDroit(req.body.type_droit)
        await reqExcel(getDataByFilter(req.params.option, res, 'requests', null, null, req.body, 
                        req.params.dateStart, req.params.dateEnd), res, 'Rapport des demandes')
    } catch (err) {
        logs('/api/request/toExcel', err)
        res.status(500).json({ error: 'Error on export' })
    }
})


app.post('/api/tasks/:option/:dateStart/:dateEnd/:offset/:limit', async(req, res) => {
    try {
        if(req.body.type_droit)
            req.body.type_droit = transformTypeDroit(req.body.type_droit)
        const offsetLimit = formatOffsetLimit(req.params.offset, req.params.limit)
        const ret = await getDataByFilter(req.params.option, res, 'tasks', offsetLimit[0], offsetLimit[1],
                        req.body,
                        req.params.dateStart, req.params.dateEnd)
        res.json(ret)
    } catch (err) {
        logs('/api/requests/', err)
        res.status(500).end()
    }
})
app.post('/api/tasks/:option/:dateStart/:dateEnd/toExcel', async(req, res) => {
    try {
        if(req.body.type_droit)
            req.body.type_droit = transformTypeDroit(req.body.type_droit)
await reqExcel(getDataByFilter(req.params.option, res, 'tasks', null , null, req.body, req.params.
        dateStart,
        req.params.dateEnd), res, 'Rapport des taches')
    } catch (err) {
        logs('/api/request/toExcel', err)
        res.status(500).json({ error: 'Error on export' })
    }
    })
    
    // ENDPOINT GET : les identités */
    app.get('/api/identities/:eid/:dateStart/:dateEnd', async(req, res) => {
        try {
            // firstly, get identity by eid
            const identity = (await pool.query(sql_reqs['get_identity_by_eid'], [req.params.eid])).rows
            if (identity.length == 0) {
                // utilisateur introuvable
                res.status(404).end()
            } else {
                const my_cellules_locales_poles_list = 
                    await get_my_cellules_locales_poles_list(res.locals.userInfo.sub)
                const cellule_centrale = (await pool.query(sql_reqs['cellule_centrale_check'], 
                        [res.locals.userInfo.sub])).rows[0].res != '0';
                if (cellule_centrale || my_cellules_locales_poles_list.includes(identity[0].pole)) {
                    // ret json
                    const ret = {}
                    ret['identity'] = identity[0]
                    // get current habilitations
                    ret['habilitations'] = (await pool.query(sql_reqs['get_habilitations_by_eid'], 
                        [req.params.eid])).rows
                    ret['habilitations_logs'] = (await pool.query(sql_reqs['get_habilitations_logs_by_eid'], 
                        [req.params.eid, req.params.dateStart, req.params.dateEnd])).rows
                    ret['mobilities'] = (await pool.query(sql_reqs['get_mobilities_by_eid'], ['Identity'+ +
                        req.params.eid,
                    req.params.dateStart,
                    req.params.dateEnd])).rows
                res.json(ret)
            } else {
                res.status(401).end()
            }
        }
    } catch (err) {
        logs('/api/identities/:eid/:dateStart/:dateEnd', err)
        res.status(500).end()
    }
})
/* ENDPOINT GET : les habilitations sous format export */
app.post('/api/habilitations/:option/:offset/:limit', async(req, res) => {
    try {
        if (req.body.type_droit)
            req.body.type_droit = transformTypeDroit(req.body.type_droit)
        const offsetLimit = formatOffsetLimit(req.params.offset, req.params.limit)
        const ret = await getDataByFilter(req.params.option, res, 'habilitations', offsetLimit[0],
            offsetLimit[1], req.body)
        res.json(ret)
    } catch (err) {
        logs('/api/habilitations/', err)
        res.status(500).end()
    }
})
app.post('/api/habilitations/:option/toExcel', async(req, res) => {
    try {
        if (req.body.type_droit)
            req.body.type_droit = transformTypeDroit(req.body.type_droit)
        await reqExcel(getDataByFilter(req.params.option, res, 'habilitations', null, null, req.body), res,
        'Rapport des habilitations')
    } catch (err) {
        logs('/api/habilitations/toExcel', err)
        res.status(500).json({ error: 'Error on export'})
    }
})

/* ENDPOINT GET : les habilitations sous format export */
app.post('/api/convergencehabilitation/:option/:offset/:limit', async(req, res) => {
    try {
        const offsetLimit = formatOffsetLimit(req.params.offset, req.params.limit)
        const ret = await getDataByFilter(req.params.option, res, 'convergencehabilitation', offsetLimit[0],
            offsetLimit[1], req.body)
        res.json(ret)
    } catch (err) {
        logs('/api/convergencehabilitation/', err)
        res.status(500).end()
    }
})
app.post('/api/convergencehabilitation/:option/toExcel', async(req, res) => {
    try {
        //await reqExcelHugeSizeFile(getDataByFilter(req.params.option, res, 'convergencehabilitation',
        //     null, null, req.body), res, 'Convergence - rapport des habilitations')
        await reqExcelHugeSizeFile(req, res, 'Convergence - rapport des habilitations')
    } catch (err) {
        logs('/api/convergencehabilitation/toExcel', err)
        res.status(500).json({ error: 'Error on export' })
    }
})

/* ENDPOINT GET : les habilitations sous format export */
app.post('/api/sod/:option/:offset/:limit', async(req, res) => {
    try {
        const offsetLimit = formatOffsetLimit(req.params.offset, req.params.limit)
        const ret = await getSODHM(req.params.option, res, 'sodview', offsetLimit[0], offsetLimit[1], req.body)
        res.json(ret)
    } catch (err) {
        logs('/api/sod/', err)
        res.status(500).end()
    }
})

app.post('/api/sod/:option/toExcel', async(req, res) => {
    try {
        await reqExcel(getSOD(req.params.option, res, 'sod', null, null, req.body), res, 'Rapport des SOD')
    } catch (err) {
        logs('/api/sod/toExcel', err)
        res.status(500).json({ error: 'Error on export' })
    }
})
app.get('/api/sodfiltre/:idrule', async(req, res) => {
    try {
        const ret = await getSODDetail(req.params.idrule);
        res.json(ret)
    } catch (err) {
        logs('/api/sod/', err)
        res.status(500).end()
    }
})

async function perimeters_extraction(req, res, exporting = false) {
    Object.keys(req.body).forEach(function(e) {
        query = query.whereILike(e, '%' + req.body[e] + '%')
    });

    // eid user
    const eid = res.locals.userInfo.sub;
    // on recupere toutes les habilitations de l'user connecté
    let habi = (await pool.query(sql_reqs['user_habi2'], [eid])).rows.map(e => e.libelle_droit);
    // que veut l'utilisateur ?
    const option = req.params.option
    let field = ''

    if (option == '6') {
        // cellule locale
        field = 'cellule_locale_gestionnaire'
    } else if (option == '7') {
        // tous
        let liste30 = []

        const codeUniqueCLUtilisateur = (await pool.query(sql_reqs['v3_si_CL_ou_non2'], [eid])).rows

        // IMPORTANT : POUR CHANGER DE CL ON DECOMENTE LA LIGNE SUIVANTE (en plaçant un code unique (équipe) de son choix)
        // liste30[0]= "E-0000001080"
        liste30 = codeUniqueCLUtilisateur.map(k => k.code_unique);

        if(liste30.includes("ITG_MyAccess_Administrateur central")) {
            liste30[0] = "ITG_MyAccess_Administrateur central"
        }






        if (liste30[0] === "ITG_MyAccess_Administrateur central") {
            if (exporting === true) return await reqExcel(query.select('*').distinct(), res, 
                'Rapport des périmètres')
            return res.json({
                objects: await query.clone().select('*').distinct().offset(offsetLimit[0]).limit(offsetLimit[1]),
                count:  await query.distinct().count()
            })
        } 
        else {
            res.status(400).json('Option code invalid')
            return
        }
    
    } else {
        // cas error
        res.status(400).json('Option code invalid')
        return
    }
    
    if (exporting === true) return await reqExcel(query.whereIn(field, habi).select('*').distinct(), res, 
        'Rapport des périmètres')
    res.json({
        objects: await query.clone().whereIn(field, habi).select('*').distinct().offset(offsetLimit[0])
            .limit(offsetLimit[1]),
        count:  await query.whereIn(field, habi).distinct().count()
    })
}

app.post('/api/perimeters-extraction/:option/toExcel', async(req, res) => {
    try {
        await perimeters_extraction(req, res, true)
    } catch (err) {
        logs('/api/perimeters-extraction/:option/toExcel', err)
        res.status(500).end()
    }
})

app.post('/api/perimeters-extraction/:option/:offset/:limit', async(req, res) => {
    try {
        await perimeters_extraction(req, res, false)
    } catch (err) {
        logs('/api/perimeters-extraction/:option/:offset/:limit', err)
        res.status(500).end()
    }
})

app.get('/api/user_plus_300_droits_extraction/:option', async(req, res) => {
    try {
        const habUser = (await pool.query(sql_reqs['getUsersHab'], [req.params.option])).rows
        res.json(habUser)
    } catch (err) {
        logs('/api/user_plus_300_droits_extraction/:option', err)
        res.status(500).end()
    }
})



async function rights_extraction(req, res, exporting = false) {

    // eid user
    const eid = res.locals.userInfo.sub;
    // on recupere toutes les habilitations de l'user connecté
    let habi = (await pool.query(sql_reqs['user_habi'], [eid])).rows.map(e => e.code_unique);
    // que veut l'utilisateur ?
    const option = req.params.option
    let field = ''
    
    if (option == '1') {
        // proprio
        field = 'proprietaire_id'
    } else if (option == '2') {
        // valideur
        field = 'valideur_1_id'
    } else if (option == '4') {
        // imp
        field = 'implementeurs_id'
    } else if (option == '6') {
        // cellule locale
        field = 'cellule_locale_gestionnaire_id'
    } else if (option == '7' || option == '8') {
        // tous
        if (exporting === true) return await reqExcel(query.select('*').distinct(), res, 'Rapport des droits')
        return res.json({
            objects: await query.clone().select('*').distinct().offset(offsetLimit[0]).limit(offsetLimit[1]),
            count: await query.distinct().count()
        })
    } else {
        // cas error
        res.status(400).json('Option code invalid')
        return
    }

    
    if (exporting === true) return await reqExcel(query.whereIn(field, habi).select('*').distinct(), res, 'Rapport des droits')
        res.json({
            objects: await query.clone().whereIn(field, habi).select('*').distinct().offset(offsetLimit[0]).limit(offsetLimit[1]),
            count: await query.whereIn(field, habi).distinct().count()
        })
    }
    app.post('/api/rights-extraction/:option/toExcel', async(req, res) => {
        try {
            if(req.body.type)
                req.body.type = transformTypeDroit(req.body.type)
            await rights_extraction(req, res, true)
        } catch (err) {
            logs('/api/rights-extraction/:option/toExcel', err)
            res.status(500).end()
        }
    })
    app.post('/api/rights-extraction/:option/:offset/:limit', async(req, res) => {
        try {
            if(req.body.type)
                req.body.type = transformTypeDroit(req.body.type)
            await rights_extraction(req, res, false)
        } catch (err) {
            logs('/api/rights-extraction/:option/:offset/:limit', err)
            res.status(500).end()
        }
    })
    async function assets(req, res, exporting = false) {
        const offsetLimit = formatOffsetLimit(req.params.offset, offset, req.params.limit)
        query = knex('assets_view')
        Object.keys(req.body).forEach(function(e) {
            query = query.whereILike(e, '%' + req.body[e] + '%')
        });
        const eid = res.locals.userInfo.sub
        let habi = (await pool.query(sql_reqs['user_habi'], [eid])).rows.map(e => e.code_unique)
        const option = req.params.option
        let field = ''
    
        if (option == '1') {
            // proprio
            field = 'proprietaire_id'
        } else if (option == '6') {
            // cellule locale
            field = 'cellule_locale_gestionnaire_id'
        } else if (option == '7' || option == '8') {
            // tous
            if (exporting === true) return await reqExcel(query, res, 'Rapport des assets')
            return res.json({
                objects: await query.clone().offset(offsetLimit[0]).limit(offsetLimit[1]),
                count: await query.count()
            })
        } else {
            res.status(400).json('Option code invalid')
            return
        }
        if (exporting === true) return await reqExcel(query.whereIn(field, habi).select(), res, 'Rapport des assets')
        res.json({
            objects: await query.clone().whereIn(field, habi).offset(offsetLimit[0]).limit(offsetLimit[1]),
            count: await query.whereIn(field, habi).count()
        })
    }
        

    async function assetsOptions(eid) {
        return ret = {
            proprietaire:         (await pool.query(sql_reqs['check_assets_proprio'], [eid])).rows[0].count != '0',
            cellule_locale:       (await pool.query(sql_reqs['check_assets_cellule'], [eid])).rows[0].count != '0',
            cellule_centrale:     (await pool.query(sql_reqs['cellule_centrale_check'], [eid])).rows[0].res != '0',
            csirt:                (await pool.query(sql_reqs['csirt_check'], [eid])).rows[0].res != '0'
        }
    }
    app.get('/api/assets/getOptions', async (req, res) => {
        try {
            const eid = res.locals.userInfo.sub
            res.json(await assetsOptions(eid))
        } catch (err) {
            logs('/api/assets/getOptions', err)
            res.status(500).end()
        }
    })
    app.get('/api/rafraichissementCertif', async (req, res) => {
        try {
            const etat = (await pool.query(sql_reqs['etatCertif'])).rows
            res.json({ etat: etat })
        } catch (err) {
            logs('/api/rafraichissementCertif', err)
            res.status(500).end()
        }
    })
    app.post('/api/assets/:option/toExcel', async (req, res) => {
        try {
            await assets(req, res, true)
        } catch (err) {
            logs('/api/assets/:option/toExcel', err)
            res.status(500).end()
        }
    })
    app.post('/api/assets/:option/:offset/:limit', async (req, res) => {
        try {
            await assets(req, res, false)
        } catch (err) {
            logs('/api/assets/:option/:offset/:limit', err)
            res.status(500).end()
        }
    })
    


/* ----------------------   PARTIE CERTIFICATION DEBUT  ---------------------- */
// WebService pour générer le fichier csv pour un rapport de campagne de type cellule locale Gestionnaire de droit
app.post('/api/v3/certificationStage2/:option/toExcel', async (req, res) => {
    try {
        // DEBUT : Calcul pour déterminer à quelle Cellule Appartient la personne
        const body1 = res.locals.userInfo.sub
        const body0 = req.body.uid
        const liste1 = []                          // liste1 correspond aux libellés des équipes
        const liste3 = []                          // liste4 liste recensant les droits d’une CL Gest
        const liste4 = []
        let i = 0

        let bodyCampagne = [];

        const ret3 = (await pool.query(sql_reqs['v3ListeCL'])).rows
        for (i; i < ret3.length; i++) {
            liste1[i] = ret3[i].code_unique;
        }

        liste1[ret3.length] = "ITG_MyAccess_Administrateur central";

        const codeUniqueDesCLAuxquelIlAppartient = (await pool.query(sql_reqs['v3_si_cl_ou_non'], [body1, liste1])).rows

        // IMPORTANT : POUR CHANGER DE CL ON DECOMENTE LA LIGNE SUIVANTE (en plaçant un code unique (équipe) de son choix) ET ON COMENTE LA BOUCLE
        // liste3[0]="E-0000001080"

        for (let k = 0; k < codeUniqueDesCLAuxquelIlAppartient.length; k++) {
            liste3[k] = codeUniqueDesCLAuxquelIlAppartient[k].code_unique;
        }

        if(liste3.includes("ITG_MyAccess_Administrateur central")) {
            liste3[0] = "ITG_MyAccess_Administrateur central"
        }

        // FIN : Calcul pour déterminer à quelle Cellule Appartient la personne
        // DEBUT : Déterminer le pôle de la CL
        const recuperelaCLDeLaPersonne = (await pool.query(sql_reqs['get_CLDeLaPersonne'], [liste3[0]])).rows

        const poleDeLaPersonne = recuperelaCLDeLaPersonne[0].libelle.value
        // FIN : déterminer le nom de la CL
        const listeDroitsDeLaCLGestionnaire = (await pool.query(sql_reqs['v3listeDroitsDeLaCLGestionnairez'], 
            [poleDeLaPersonne])).rows

        for (let j = 0; j < listeDroitsDeLaCLGestionnaire.length; j++) {
            liste4[j] = listeDroitsDeLaCLGestionnaire[j].code_unique
        }

        // FIN : Récupère les droits dont est gestionnaire la CL
        // DEBUT : Récupère les campagnes choisies par l’utilisateur
        for (let j = 0; j < req.body.selectionMotCampagnes.length; j++) {
            bodyCampagne[j] = req.body.selectionMotCampagnes[j].nom_de_la_campagne_de_certification;
        }

        // FIN : Récupère les campagnes choisies par l’utilisateur
        // DEBUT : Cas Cellule Déploiement -> Générer Rapport csv
        if (liste3[0] == "ITG_MyAccess_Administrateur central") {

            let name_nom_de_la_campagne_de_certification = "nom_de_la_campagne_de_certification"

            // AJOUTER UN ELEMENT DANS UN JSON
            const reqBody = getData(req)

            let query = knex('certification6vjuin23').whereIn(name_nom_de_la_campagne_de_certification, bodyCampagne)
            Object.keys(reqBody).forEach(function(e) {
                query = query.whereILike(e, '%' + reqBody[e] + '%')
            })

            await reqExcel(query.select('uo_du_beneficiaire', 'beneficiaire', 'pole_du_beneficiaire',
                'metier_du_beneficiaire', 'typologie_de_l_habilitation_revue', 'libelle_de_l_asset',
                'code_unique_role',
                'libelle_du_role', 'description_du_role', 'nom_de_la_campagne_de_certification',
                'statut_de_la_certification', 'destinataire_de_la_certification', 'recertificateur', 'decision',
                'date_de_la_decision', 'commentaires_du_recertificateur', 'reassigne_par', 'reassigne_le',
                'dernier_transfert_le', 'dernier_transfert_par', 'date_de_creation', 'date_activation',
                'date_de_signature'), 'Rapport des campagnes');

            // FIN : Cas Cellule Déploiement -> Générer Rapport csv
            // DEBUT : Cas Cellule Locale -> Générer Rapport csv
        } else {
            // AJOUTER UN ELEMENT DANS UN JSON
            const reqBody = getData(req);
            let name_nom_de_la_campagne_de_certification = "nom_de_la_campagne_de_certification"
            let libelleDuRole = "code_unique_role"

            let query = knex('certification6vjuin23').whereIn(name_nom_de_la_campagne_de_certification,
                bodyCampagne).whereIn(libelleDuRole, liste4)
            Object.keys(reqBody).forEach(function(e) {
                query = query.whereILike(e, '%' + reqBody[e] + '%')
            })

            await reqExcel(query.select('uo_du_beneficiaire', 'beneficiaire', 'pole_du_beneficiaire',
                'metier_du_beneficiaire', 'typologie_de_l_habilitation_revue', 'libelle_de_l_asset',
                'code_unique_role',
                'libelle_du_role', 'description_du_role', 'nom_de_la_campagne_de_certification',
                'statut_de_la_certification', 'destinataire_de_la_certification', 'recertificateur', 'decision',
                'date_de_la_decision', 'commentaires_du_recertificateur', 'reassigne_par', 'reassigne_le',
                'dernier_transfert_le', 'dernier_transfert_par', 'date_de_creation', 'date_activation',
                'date_de_signature'), res, 'Rapport des campagnes');
            }
            //FIN : Cas cellule Locale -> Generer Rapport csv
        } catch (err){
logs('api/v3certificationStage2/:option/toExcel', err)
res.status(500).end()
        }
    })





    // WebService pour générer les listes déroulantes Année de certification et Campagne de certification lorsque l’on se
// rend sur le module Certification -> Rapport -> Cellule Locale Gestionnaire de Droit
app.post('/api/cert/certif3/requests_options4', async (req, res) => {
    try {
        // DEBUT : Calcul pour déterminer à quelle Cellule Appartient la personne
        const body0 = res.locals.userInfo.sub
        const body1 = req.body.uid
        const body2 = req.body.ann

        //liste 1 correspond aux codes uniques des équipes
        const liste1 = []
        //liste 2 correspond aux libellés des équipes
        const liste2 = []
        //liste 3
        const liste3 = []
        //liste 4 liste recensant les droits d’une CL Gest
        const liste4 = []
        let i = 0

        const ret3 = (await pool.query(sql_reqs['v3listeCL'])).rows
        const ret2 = (await pool.query(sql_reqs['v3listeCL2'])).rows
        for (i; i < ret3.length; i++) {
            liste1[i] = ret3[i].code_unique;
        }

        liste1[ret3.length] = "ITG_MyAccess_Administrateur central"

        for (let j = 0; j < ret2.length; j++) {
            liste2[j] = ret2[j].libelle[0].value
        }

        //CL auquel on est affecté
        const codeUniqueDesCLAuquelIlAppartient = (await pool.query(sql_reqs['v3_si_CL_ou_non'], [body1, liste1])).rows

    //IMPORTANT : POUR CHANGER DE CL ON DECOMENTE LA LIGNE SUIVANTE (en plaçant un code unique (équipe) de son choix) ET ON COMMENTE LA BOUCLE
    //liste3[0]= "E-0000001080"
    //liste3[0]= "E-0000001629"

    for (let k = 0; k < codeUniqueDesCLAuquelIlAppartient.length; k++) {
        liste3[k] = codeUniqueDesCLAuquelIlAppartient[k].code_unique;
    }

    if(liste3.includes("ITG_MyAccess_Administrateur central")) {
        liste3[0] = "ITG_MyAccess_Administrateur central"
    }

    // FIN : Calcul pour déterminer à quelle Cellule Appartient la personne
    // DEBUT : Cas Cellule Déploiement
    if (liste3[0] == "ITG_MyAccess_Administrateur central") {
        const listedéroulanteAnnee1 = (await pool.query(sql_reqs['v3listeDéroulanteAnnee1ALL'])).rows
        const visibilité = true
        const poleDeLaPersonne = "ITG_MyAccess_Administrateur central"

        // Liste Déroulante Année
        if (body2 == null) {
            res.json({ liste2: listedéroulanteAnnee1, vis2: visibilité, pole2: poleDeLaPersonne });
        }
        // Liste Déroulante Campagne
        else {
            const listedéroulanteAnnee1 = (await pool.query(sql_reqs['v3listeDéroulantePole1ALL'], [body2])).rows
            res.json({ liste2: listedéroulanteAnnee1, vis2: visibilité, pole2: poleDeLaPersonne });
        }
    }
    // FIN : Cas Cellule Déploiement
    // DEBUT : Cas ni Cellule Locale ni Cellule Déploiement
    else if (liste3.length == 0) {
        const listedéroulanteAnnee1 = ""
        const visibilité = false
        const poleDeLaPersonne = null
        res.json({ liste2: listedéroulanteAnnee1, vis2: visibilité, pole2: poleDeLaPersonne });
    }
    // FIN :  Cas ni Cellule Locale ni Cellule Déploiement
    // DEBUT : Cas Cellule Locale
    else {
        const recuperelaCLDeLaPersonne = (await pool.query(sql_reqs['CLDeLaPersonne'], [liste3[0]])).rows
        const poleDeLaPersonne = recuperelaCLDeLaPersonne[0].libelle[0].value
        const listeDroitsDeLaCLGestionnaire = (await pool.query(sql_reqs['v3listeDroitsDeLaCLGestionnaire2'], [poleDeLaPersonne])).rows
        for (let j = 0; j < listeDroitsDeLaCLGestionnaire.length; j++) {
            liste4[j] = listeDroitsDeLaCLGestionnaire[j].code_unique
        }
        const v3listeDéroulanteAnnee1FiltrePoleStage2 = (await pool
            .query(sql_reqs['v3listeDéroulanteAnnee1FiltrePoleStage2bis'], [liste4])).rows

        for (let m = 0; m < v3listeDéroulanteAnnee1FiltrePoleStage2.length; m++) {
            liste5[m] = v3listeDéroulanteAnnee1FiltrePoleStage2[m].substr;
        }
        const visibilité = true
        // Liste Déroulante Année
        if (body2 == null) {
            res.json({ liste2: v3listeDéroulanteAnnee1FiltrePoleStage2, vis2: visibilité, pole2: poleDeLaPersonne });
        }
        // Liste Déroulante Campagne
        else {
            const listedéroulanteAnnee1 = (await pool
                .query(sql_reqs['v3listeDéroulantePoleFiltrePoleStage2bis'], [liste4, body2])).rows
            res.json({ liste2: listedéroulanteAnnee1, vis2: visibilité, pole2: poleDeLaPersonne });
        }
    }
// FIN : Cas Cellule Locale
} catch (err) {
    logs('/api/cert/certif/requests_options4', err)
    res.status(500).end()
}
});

// WebService pour générer les listes déroulantes Année de certification et Campagne de certification lorsque l’on se
// rend sur sur le module Certification -> Rapport -> Pôle du bénéficiaire
app.post('/api/cert/certif/requests_options3', async(req, res) => {
try {
    // DEBUT : Calcul pour déterminer à quelle Cellule Appartient la personne
    const body1 = res.locals.userInfo.sub
    const body2 = req.body.annee
    // liste 1 correspond aux codes uniques des équipes
    const liste1 = []
    // liste 2 correspond aux libellés des équipes
    const liste3 = []
    let i = 0

    const ret3 = (await pool.query(sql_reqs['v3listeCL'])).rows
    for (i; i < ret3.length; i++) {
        liste1[i] = ret3[i].code_unique
        liste3[i] = ret3[i].libelle
    }
    liste1[ret3.length] = "ITG_MyAccess_Administrateur central";

    //CL auquel on est affecté
    const codeUniqueDesCLAuquelIlAppartient = (await pool.query(sql_reqs['v3_cl_ou_non'], [body1, liste1])).rows

    // IMPORTANT : POUR CHANGER DE CL ON DECOMENTE LA LIGNE SUIVANTE (en placant un code unique (équipe) de son choix) ET ON COMMENTE LA BOUCL
    // liste3[0] = "0E000018000"
    // liste3[0] = "0E000026019"

    for (let k = 0; k < codeUniqueDesCLAuquelIlAppartient.length; k++) {
        liste3[k] = codeUniqueDesCLAuquelIlAppartient[k].code_unique
    }

    if (liste3.includes("ITG_MyAccess_Administrateur central")) {
        liste3[0] = "ITG_MyAccess_Administrateur central"
    }
    // FIN : calcul pour déterminer à quelle cellule appartient la personne
    // DEBUT : Cas Cellule Déploiement
    if (liste3[0] === "ITG_MyAccess_Administrateur central"){
    const listeDeroulanteAnnee1 = (await pool.query(sql_reqs['v3listeDeroulanteAnneeALL'])).rows
    const visibilité = true
    //const poleDeLaPersonne = "ITG_MyAccess_Administrateur central"
    const poleDeLaPersonne = "Tous les pôles (cellule déploiement)"
    // Liste Déroulante Année
    if (body2 === null) {
        res.json({ liste1: listeDeroulanteAnnee1, visi: visibilité, pole: poleDeLaPersonne });
    }
    // Liste Déroulante Campagne
    else {
        const listeDeroulanteAnnee1 = (await pool.query(sql_reqs['v3listeDeroulantePole1All'], [body2])).rows
        res.json({ liste1: listeDeroulanteAnnee1, visi: visibilité, pole: poleDeLaPersonne });
    }
}
    // FIN : Cas Cellule Déploiement
    // DEBUT : Cas ni Cellule Locale ni Cellule Déploiement
    else if (liste3.length === 0) {
        const listeDeroulanteAnnee1 = ""
        const visibilité = false
        const poleDeLaPersonne = null
        res.json({ liste1: listeDeroulanteAnnee1, visi: visibilité, pole: poleDeLaPersonne });
    }
    // FIN : Cas ni Cellule Locale ni Cellule Déploiement
    // Cas Cellule Locale
    else {
        const recuperelePoleDeLaPersonne = (await pool.query(sql_reqs['recuperelePoleDeLaPersonne'], [liste3[0]])).rows
        const poleDeLaPersonne = []
        for (let m = 0; m < recuperelePoleDeLaPersonne[0].poles.length; m++) {
            poleDeLaPersonne[m] = recuperelePoleDeLaPersonne[0].poles[m]
        }
        const listeDeroulanteAnnee1 = (await pool.query(sql_reqs['v3listeDeroulanteAnnee1FiltrePole'], [poleDeLaPersonne])).rows
        const visibilité = true
        // Liste Déroulante Année
        if (body2 === null) {
            res.json({ liste1: listeDeroulanteAnnee1, visi: visibilité, pole: poleDeLaPersonne });
        }
        // Liste Déroulante Campagne
        else {
            const listeDeroulanteAnnee1 = (await pool.query(sql_reqs['v3listeDeroulantePole1FiltrePole'], [poleDeLaPersonne, body2])).rows
            res.json({ liste1: listeDeroulanteAnnee1, visi: visibilité, pole: poleDeLaPersonne });
        }
    }
    // FIN : Cas Cellule Locale
    } catch (err) {
        logs('/api/cert/certif/requests_options3', err)
        res.status(500).end()
    }
});

// WebService pour générer le fichier csv pour un rapport de campagne de type Pôle du bénéficiaire
app.post('/api/xcertificationStage//:option/toExcel', async (req, res) => {
    try {
        // DEBUT : Calcul pour déterminer à quelle Cellule Appartient la personne
        const body1 = res.locals.userInfo.sub
        // liste 1 = []
        // liste 2 correspond aux libellés des équipes
        const liste1 = []
        const liste3 = []
        let i = 0

        const ret3 = (await pool.query(sql_reqs['v3listeCL'])).rows
        for (i; i < ret3.length; i++) {
            liste1[i] = ret3[i].code_unique;
        }
        liste1[ret3.length] = "ITG_MyAccess_Administrateur central";

        //CL auquel on est affecté
        const codeUniqueDesCLAuquelIlAppartient = (await pool.query(sql_reqs['v3_si_cl_ou_non'], [body1, liste1])).rows

        // IMPORTANT : POUR CHANGER DE CL ON DECOMENTE LA LIGNE SUIVANTE (en plaçant un code unique (équipe) de son choix) ET ON COMMENTE LA BOUC
        // liste3[0]="0E-0000000180"
        // liste3[0]="0E-0000001269"

        for (let k = 0; k < codeUniqueDesCLAuquelIlAppartient.length; k++) {
            liste3[k] = codeUniqueDesCLAuquelIlAppartient[k].code_unique
        }

        if(liste3.includes("ITG_MyAccess_Administrateur central")){
            liste3[0] = "ITG_MyAccess_Administrateur central"
        }

        // FIN : Calcul pour déterminer à quelle Cellule Appartient la personne
        // DEBUT : récupérer les campagnes choisies par l'utilisateur
        let bodyCampagne = [];
        for (let j = 0; j < req.body.selectionMotCampagnes.length; j++) {
            bodyCampagne[j] = req.body.selectionMotCampagnes[j].nom_de_la_campagne_de_certification;
        }
// FIN : Récupère les campagnes choisies par l’utilisateur
// DEBUT : Cas Cellule Déploiement -> Générer Rapport csv
if (liste3[0] === "ITG_MyAccess_Administrateur central") {
    let name_nom_de_la_campagne_de_certification = "nom_de_la_campagne_de_certification"

    // AJOUTER UN ELEMENT DANS UN JSON
    const reqBody = getData(req);
    let query = knex('certification6vijun23').whereIn(name_nom_de_la_campagne_de_certification,bodyCampagne);
    Object.keys(reqBody).forEach(function(e) {
        query = query.whereLike(e, '%' + reqBody[e] + '%')
    })

    await reqExcel(query.select('uo_du_beneficiaire', 'beneficiaire', 'pole_du_beneficiaire', 'metier_du_beneficiaire',
        'typologie_de_l_habilitation_revue', 'libelle_de_l_asset', 'code_unique_role',
        'libelle_du_role','description_du_role', 'nom_de_la_campagne_de_certification', 'statut_de_la_certification',
        'destinataire_de_la_certification', 'recertificateur', 'decision',
        'date_de_la_decision', 'commentaires_du_recertificateur', 'reassigne_par', 'reassigne_le', 'dernier_transfert_le',
        'dernier_transfert_par', 'date_de_creation', 'date_activation', 'date_de_signature'), res, "Rapport des campagnes");

} 
// FIN : Cas Cellule Déploiement -> Générer Rapport csv
// DEBUT : Cas Cellule Locale -> Générer Rapport csv
else { 
    const recuperelePoleDeLaPersonne = (await pool.query(sql_reqs['poleDeLaPersonne'], [liste3[0]])).rows
    let poleDeLaPersonne = []
    for (let m = 0; m < recuperelePoleDeLaPersonne[0].poles.length; m++) {
        poleDeLaPersonne[m] = recuperelePoleDeLaPersonne[0].poles[m]
    }

    // AJOUTER UN ELEMENT DANS UN JSON
    const reqBody = getData(req)
    let name_nom_de_la_campagne_de_certification = "nom_de_la_campagne_de_certification"

    let pole_du_beneficiaire = "pole_du_beneficiaire"

    let query = knex('certification6vijun23').whereIn(name_nom_de_la_campagne_de_certification,bodyCampagne).
    whereIn(pole_du_beneficiaire, poleDeLaPersonne)
    Object.keys(reqBody).forEach(function(e) {
        query = query.whereLike(e, '%' + reqBody[e] + '%')
    })

    await reqExcel(query.select('uo_du_beneficiaire', 'beneficiaire', 'pole_du_beneficiaire', 'metier_du_beneficiaire',
        'typologie_de_l_habilitation_revue', 'libelle_de_l_asset', 'code_unique_role',
        'libelle_du_role','description_du_role', 'nom_de_la_campagne_de_certification', 'statut_de_la_certification',
        'destinataire_de_la_certification', 'recertificateur', 'decision',
        'date_de_la_decision', 'commentaires_du_recertificateur', 'reassigne_par', 'reassigne_le', 'dernier_transfert_le',
        'dernier_transfert_par', 'date_de_creation', 'date_activation', 'date_de_signature'), res, "Rapport des campagnes");
}
// FIN : Cas Cellule locale -> Générer Rapport CSV
} catch (err) {
    logs('/api/v3certificationStage1/:option/toExcel', err)
    res.status(500).end()
}
});

// WebService pour générer le rapport de campagne de type Pôle du bénéficiaire
app.post('/api/v3certificationStage1/:option/:offset/:limit/', async (req, res) => {
try {
    // DEBUT : Calcul pour déterminer à quelle Cellule Appartient la personne
    const body1 = res.locals.userInfo.sub
    // const body1 = req.body.uid
    // liste 1 = []
    // liste 2 correspond aux libellés des équipes
    const liste1 = []
    const liste3 = []
    let i = 0

    const ret3 = (await pool.query(sql_reqs['v3listeCL'])).rows
    for (i; i < ret3.length; i++) {
        liste1[i] = ret3[i].code_unique;
    }
    liste1[ret3.length] = "ITG_MyAccess_Administrateur central";

    //CL auquel on est affecté
    const codeUniqueDesCLAuquelIlAppartient = (await pool.query(sql_reqs['v3_si_cl_ou_non'], [body1, liste1])).rows

    // IMPORTANT : POUR CHANGER DE CL ON DECOMENTE LA LIGNE SUIVANTE (en plaçant un code unique (équipe) de son choix) ET ON COMMENTE LA BOUC
    // liste3[0]="0E-0000000180"
    // liste3[0]="0E-0000016269"

    let p = 0
    for (p; p < codeUniqueDesCLAuquelIlAppartient.length; p++) {
        liste3[p] = codeUniqueDesCLAuquelIlAppartient[p].code_unique;
    }

    if(liste3.includes("ITG_MyAccess_Administrateur central")){
        liste3[0] = "ITG_MyAccess_Administrateur central"
    }

    // FIN : Calcul pour déterminer à quelle Cellule Appartient la personne

    // Récupération de l’offset et de la limit
    const offsetLimit = formatOffsetLimit(req.params.offset, req.params.limit);
    // DEBUT – Récupère les campagnes choisies par l’utilisateur
    let bodyCampagne = [];
    for (let j = 0; j < req.body.selectionMotCampagnes.length; j++) {
        bodyCampagne[j] = req.body.selectionMotCampagnes[j].nom_de_la_campagne_de_certification;
    }
    
    // FIN : Récupère les campagnes choisies par l’utilisateur
    // DEBUT : Cas Cellule Déploiement
    if (liste3[0] === "ITG_MyAccess_Administrateur central") {
    
        let name_nom_de_la_campagne_de_certification = "nom_de_la_campagne_de_certification"
    
        // AJOUTER UN ELEMENT DANS UN JSON
        const reqBody = getData(req);
    
        let query = knex('certification6vijun23').whereIn(name_nom_de_la_campagne_de_certification, bodyCampagne)
        Object.keys(reqBody).forEach(function(e) {
            query = query.whereLike(e, '%' + reqBody[e] + '%')
        })
    
        res.json({
            objects: (await query.clone()
                .select('uo_du_beneficiaire', 'beneficiaire', 'pole_du_beneficiaire', 'metier_du_beneficiaire',
                    'typologie_de_l_habilitation_revue', 'libelle_de_l_asset', 'code_unique_role',
                    'libelle_du_role', 'description_du_role', 'nom_de_la_campagne_de_certification', 'statut_de_la_certification',
                    'destinataire_de_la_certification', 'recertificateur', 'decision',
                    'date_de_la_decision', 'commentaires_du_recertificateur', 'reassigne_par', 'reassigne_le', 'dernier_transfert_le',
                    'dernier_transfert_par', 'date_de_creation', 'date_activation', 'date_de_signature')
                .offset(offsetLimit[0]).limit(offsetLimit[1])
            ),
            count: (await query.clone().count())
        })
    
        // FIN : Cas Cellule Déploiement
        // DEBUT : Cas Cellule Locale
    } 
    else {
        const recuperelePoleDeLaPersonne = (await pool.query(sql_reqs['poleDeLaPersonne'], [liste3[0]])).rows
        let poleDeLaPersonne = []
        for (let m = 0; m < recuperelePoleDeLaPersonne[0].poles.length; m++) {
            poleDeLaPersonne[m] = recuperelePoleDeLaPersonne[0].poles[m]
        }
    
        // AJOUTER UN ELEMENT DANS UN JSON
        const reqBody = getData(req);
        let name_nom_de_la_campagne_de_certification = "nom_de_la_campagne_de_certification"
    let pole_du_beneficiaire = "pole_du_beneficiaire"

    let query = knex('certification6vijun23')
        .whereIn(name_nom_de_la_campagne_de_certification, bodyCampagne)
        .whereIn(pole_du_beneficiaire, poleDeLaPersonne)
    Object.keys(reqBody).forEach(function(e) {
        query = query.whereLike(e, '%' + reqBody[e] + '%')
    })

    res.json({
        objects: (await query.clone()
            .select('uo_du_beneficiaire', 'beneficiaire', 'pole_du_beneficiaire', 'metier_du_beneficiaire',
                'typologie_de_l_habilitation_revue', 'libelle_de_l_asset', 'code_unique_role',
                'libelle_du_role', 'description_du_role', 'nom_de_la_campagne_de_certification', 'statut_de_la_certification',
                'destinataire_de_la_certification', 'recertificateur', 'decision',
                'date_de_la_decision', 'commentaires_du_recertificateur', 'reassigne_par', 'reassigne_le', 'dernier_transfert_le',
                'dernier_transfert_par', 'date_de_creation', 'date_activation', 'date_de_signature')
            .offset(offsetLimit[0]).limit(offsetLimit[1])
        ),
        count: (await query.clone().count())
    })

    // FIN : cas Cellule Locale
    }
 } catch (err) {
        logs('/api/v3certificationStage1/:option/:offset/:limit', err)
        res.status(500).end()
    }
});

// WebService pour générer le rapport de campagne de type cellule Gestionnaire de droit
app.post('/api/v3certificationStage2/:option/:offset/:limit', async(req, res) => {
    try {
        const body1 = res.locals.userInfo.sub
        // const body1 = req.body.uid
        const offsetLimit = formatOffsetLimit(req.params.offset, req.params.limit);

        const liste1 = []
        // liste 2 correspond aux libellés des équipes
        const liste3 = []
        // liste 4 liste recensant les droits d'une CL Gest
        let liste4 = []
        let i = 0
        let bodyCampagne = [];
        const ret3 = (await pool.query(sql_reqs['v3listeCL'])).rows
        for (i; i < ret3.length; i++) {
            liste1[i] = ret3[i].code_unique;
        }
        liste1[ret3.length] = "ITG_MyAccess_Administrateur central";
        const codeUniqueDesCLAuquelIlAppartient = (await pool.query(sql_reqs['v3_si_cl_ou_non'], [body1, liste1])).rows
        
        // IMPORTANT : POUR CHANGER DE CL ON DECOMENTE LA LIGNE SUIVANTE (en plaçant un code unique (équipe) de son choix) ET ON COMMENTE LA BOUC
        //liste3[0]="E-0000000180"
        
        for (let k = 0; k < codeUniqueDesCLAuquelIlAppartient.length; k++) {
            liste3[k] = codeUniqueDesCLAuquelIlAppartient[k].code_unique;
        }
        
        if(liste3.includes("ITG_MyAccess_Administrateur central")){
            liste3[0] = "ITG_MyAccess_Administrateur central"
        }
        
        const recuperelaCLDeLaPersonne = (await pool.query(sql_reqs['CLdeLaPersonne'], [liste3[0]])).rows
        const poleDeLaPersonne = recuperelaCLDeLaPersonne[0].libelle[0].value
        
        const listeDroitsDeLaCLGestionnaire = (await pool.query(sql_reqs['v3listeDroitsDeLaCLGestionnaire2'], [poleDeLaPersonne])).rows
        
        for (let j = 0; j < listeDroitsDeLaCLGestionnaire.length; j++) {
            liste4[j] = listeDroitsDeLaCLGestionnaire[j].code_unique
        }
        
        for (let j = 0; j < req.body.selectionMotCampagnes.length; j++) {
            bodyCampagne[j] = req.body.selectionMotCampagnes[j].nom_de_la_campagne_de_certification;
        }
        
        if (liste3[0] === "ITG_MyAccess_Administrateur central") {
            let name_nom_de_la_campagne_de_certification = "nom_de_la_campagne_de_certification"
        
            // AJOUTER UN ELEMENT DANS UN JSON
            const reqBody = getData(req);
        
            let query = knex('certification6vijun23').whereIn(name_nom_de_la_campagne_de_certification, bodyCampagne)
            Object.keys(reqBody).forEach(function(e) {
                query = query.whereLike(e, '%' + reqBody[e] + '%')
            })
        
            res.json({
                objects: (await query.clone()
                    .select('uo_du_beneficiaire', 'beneficiaire', 'pole_du_beneficiaire', 'metier_du_beneficiaire', 'typologie_de_l_habilitation_revue', 'libelle_de_l_asset', 'code_unique_role',
                        'libelle_du_role', 'description_du_role', 'nom_de_la_campagne_de_certification', 'statut_de_la_certification', 'destinataire_de_la_certification', 'recertificateur', 'decision',
                        'date_de_la_decision', 'commentaires_du_recertificateur', 'reassigne_par', 'reassigne_le', 'dernier_transfert_le', 'dernier_transfert_par', 'date_de_creation', 'date_activation', 'date_de_signature')
                        .offset(offsetLimit[0]).limit(offsetLimit[1])
                    ),
                    count: (await query.clone().count())
                })
            } else {
    // AJOUTER UN ELEMENT DANS UN JSON
    const reqBody = getData(req);
    let name_nom_de_la_campagne_de_certification = "nom_de_la_campagne_de_certification"
    // let libelleDuRole = "libelle_du_role"
    let libelleDuRole = "code_unique_role"

    let query = knex('certification6vijun23')
        .whereIn(name_nom_de_la_campagne_de_certification, bodyCampagne)
        .whereIn(libelleDuRole, liste4)
    Object.keys(reqBody).forEach(function(e) {
        query = query.whereLike(e, '%' + reqBody[e] + '%')
    })

    res.json({
        objects: (await query.clone()
            .select('uo_du_beneficiaire', 'beneficiaire', 'pole_du_beneficiaire', 'metier_du_beneficiaire', 'typologie_de_l_habilitation_revue', 'libelle_de_l_asset', 'code_unique_role',
                'libelle_du_role', 'description_du_role', 'nom_de_la_campagne_de_certification', 'statut_de_la_certification', 'destinataire_de_la_certification', 'recertificateur', 'decision',
                'date_de_la_decision', 'commentaires_du_recertificateur', 'reassigne_par', 'reassigne_le', 'dernier_transfert_le', 'dernier_transfert_par', 'date_de_creation', 'date_activation', 'date_de_signature')
                .offset(offsetLimit[0]).limit(offsetLimit[1])
            ),
            count: await query.clone().count()
    })
}
} catch (err) {
    logs('/api/v3certificationStage2/:option/:offset/:limit', err)
    res.status(500).end()
}
})
// WebService pour générer les informations générales du bilan cad
// l’achèvement, les bénéficiaires, les certificateurs, le nb d’assets, ...
app.post('/api/bilancertif/', async(req, res) => {
    try {
        const body1 = res.locals.userInfo.sub
        // const body1 = req.body.uid

        const liste1 = []
        // liste 2 correspond aux libellés des équipes
        const liste3 = []
        // liste 4 liste recensant les droits d’un CL Gest
        let liste4 = []
        let i = 0

        const ret3 = (await pool.query(sql_reqs['v3listeCL'])).rows
        for (i; i < ret3.length; i++) {
            liste1[i] = ret3[i].code_unique;
        }
        liste1[ret3.length] = "ITG_MyAccess_Administrateur central";

        const codeUniqueDesCLAuquelIlAppartient = (await pool.query(sql_reqs['v3_si_cl_ou_non'], [body1, liste1])).rows
        
        //IMPORTANT : POUR CHANGER DE CL ON DECOMENTE LA LIGNE SUIVANTE (en plaçant un code unique (équipe) de son choix) ET ON COMMENTE LA BOUC
        //liste3[0]="E-0000000180"
        
        for (let k = 0; k < codeUniqueDesCLAuquelIlAppartient.length; k++) {
            liste3[k] = codeUniqueDesCLAuquelIlAppartient[k].code_unique;
        }
        
        if(liste3.includes("ITG_MyAccess_Administrateur central")) {
            liste3[0] = "ITG_MyAccess_Administrateur central"
        }
        
        const recuperelaCLDeLaPersonne = (await pool.query(sql_reqs['CLdeLaPersonne'], [liste3[0]])).rows
        const poleDeLaPersonne = recuperelaCLDeLaPersonne[0].libelle[0].value
        
        const listeDroitsDeLaCLGestionnaire = (await pool.query(sql_reqs['v3listeDroitsDeLaCLGestionnaire2'], [poleDeLaPersonne])).rows
        
        for (let j = 0; j < listeDroitsDeLaCLGestionnaire.length; j++) {
            liste4[j] = listeDroitsDeLaCLGestionnaire[j].code_unique
        }
        
        const bodyDate = req.body.anne;
        const bodyCampagne = req.body.campagne;
        const bodyCL = req.body.cl;
        if (bodyCL != null) {
            const listeDroitsDeLaCLGestionnaire = (await pool.query(sql_reqs['v3listeDroitsDeLaCLGestionnaire2'], [bodyCL])).rows
            for (let ij = 0; ij < listeDroitsDeLaCLGestionnaire.length; ij++)
                liste4[ij] = listeDroitsDeLaCLGestionnaire[ij].code_unique
            liste3[0] = bodyCL
        }
        
        if (liste3[0] === "ITG_MyAccess_Administrateur central") {
            let poleBilan;
            if(req.body.langue=='en'){
                poleBilan = "of all management cells (central cell)"
            } else{
                poleBilan = "de toutes les cellules gestionnaires (cellule déploiement/centrale)"
            }
        
            const tableauCertifFiltreAdminCountApprovedJson = (await pool.query(sql_reqs['tableauCertifFiltreAdminCountApproved'], [bodyDate, bodyCampagne])).rows
            const tableauCertifFiltreAdminCountApproved = tableauCertifFiltreAdminCountApprovedJson[0].count
            
            const tableauCertifFiltreAdminCountApprovedNotReviewedJson = (await pool.query(sql_reqs['tableauCertifFiltreAdminCountApprovedNotReviewed'], [bodyDate, bodyCampagne])).rows
            const tableauCertifFiltreAdminCountApprovedNotReviewed = tableauCertifFiltreAdminCountApprovedNotReviewedJson[0].count
            
            const tableauCertifFiltreAdminCountRemediatedJson = (await pool.query(sql_reqs['tableauCertifFiltreAdminCountRemediated'], [bodyDate, bodyCampagne])).rows
            const tableauCertifFiltreAdminCountRemediated = tableauCertifFiltreAdminCountRemediatedJson[0].count
            
            const tableauCertifFiltreAdminCountRemediatedNotReviewedJson = (await pool.query(sql_reqs['tableauCertifFiltreAdminCountRemediatedNotReviewed'], [bodyDate, bodyCampagne])).rows
            const tableauCertifFiltreAdminCountRemediatedNotReviewed = tableauCertifFiltreAdminCountRemediatedNotReviewedJson[0].count
            
            const tableauCertifFiltreAdminCountAllJson = (await pool.query(sql_reqs['tableauCertifFiltreAdminCountAll'], [bodyDate, bodyCampagne])).rows
            const tableauCertifFiltreAdminCountAll = tableauCertifFiltreAdminCountAllJson[0].count
            
            const achevementBis = tableauCertifFiltreAdminCountApproved * 1.0 + tableauCertifFiltreAdminCountRemediated * 1.0
            const achevement = (Math.round(achevementBis / tableauCertifFiltreAdminCountAll) * 10000)
            const achevement1 = (Math.round(achevementNonArrondi)) / 100
            
            const beneficiaireJson = (await pool.query(sql_reqs['beneficiaireAdmin'], [bodyDate, bodyCampagne])).rows
            const beneficiaires = beneficiaireJson[0].count
            
            const certificateurJson = (await pool.query(sql_reqs['certificateurAdmin2'], [bodyDate, bodyCampagne])).rows
            const certificateur = certificateurJson[0].count
            
            const assetsJson = (await pool.query(sql_reqs['assetsAdmin'], [bodyDate, bodyCampagne])).rows
            const assets = assetsJson[0].count
            
            const droitsJson = (await pool.query(sql_reqs['droitsAdmin'], [bodyDate, bodyCampagne])).rows
            const droits = droitsJson[0].count
            
            const habilitationsCertifiees = tableauCertifFiltreAdminCountApproved * 1.0 + tableauCertifFiltreAdminCountRemediated * 1.0
            const habilitationsApprouveesPourcentageNonArrondi = (tableauCertifFiltreAdminCountApproved / tableauCertifFiltreAdminCountAll) * 10000
            const habilitationsApprouveesPourcentage = (Math.round(habilitationsApprouveesPourcentageNonArrondi)) / 100
            const habilitationsRejeteesPourcentageNonArrondi = (tableauCertifFiltreAdminCountRemediated / tableauCertifFiltreAdminCountAll) * 10000
            const habilitationsRejeteesPourcentage = (Math.round(habilitationsRejeteesPourcentageNonArrondi)) / 100
            const habilitationsNonRevues = tableauCertifFiltreAdminCountApprovedNotReviewed * 1.0 + tableauCertifFiltreAdminCountRemediatedNotReviewed * 1.0
            const habilitationsNonRevuesPourcentageNonArrondi = (habilitationsNonRevues / tableauCertifFiltreAdminCountAll) * 10000
            const habilitationsNonRevuesPourcentage = (Math.round(habilitationsNonRevuesPourcentageNonArrondi)) / 100
        
            let participation;
            
            const recupProgressionAdminJson = (await pool.query(sql_reqs['recupProgressionAdmin1'], [bodyDate, bodyCampagne])).rows
            const recupProgressionAdminNotRevJson = (await pool.query(sql_reqs['recupProgressionAdminNotReviewed'], [bodyDate, bodyCampagne])).rows
            
            if (recupProgressionAdminNotRevJson.length === 0) {
                let divisionPartici = 0
                for(let op of recupProgressionAdminJson) {
                    divisionPartici += ((op.nombre_lignes_etat_closed * 1.0) / (op.nombre_total_lignes * 1.0)) * 100
                }
                let participationAarrondir = ((divisionPartici * 1.0) / (recupProgressionAdminJson.length * 1.0)) * 100
                participation = (Math.round(participationAarrondir)) / 100
            } else {
                let divisionPartici = 0
                for(let op of recupProgressionAdminJson) {
                    let entree = false
                    for(let ik of recupProgressionAdminNotRevJson) {
                        if (ik.utilisateur === op.utilisateur && entree === false) {
                            divisionPartici += (((op.nombre_lignes_etat_closed * 1.0) - (ik.nombre_lignes_etat_closed * 1.0)) / (op.nombre_total_lignes * 1.0)) * 100
                            entree = true
                        }
                    }
                    if (entree === false) {
                        divisionPartici += ((op.nombre_lignes_etat_closed * 1.0) / (op.nombre_total_lignes * 1.0)) * 100
                    }
                }
                let participationAarrondir = ((divisionPartici * 1.0) / (recupProgressionAdminJson.length * 1.0)) * 100
                participation = (Math.round(participationAarrondir)) / 100
            }
            
            const total = habilitationsRejeteesPourcentage * 1.0 + habilitationsApprouveesPourcentage * 1.0 + habilitationsNonRevuesPourcentage * 1.0
            
            res.json({ nomDeLaCampagne: bodyCampagne, poleBilan: poleBilan, achevement: achevement, beneficiaire: beneficiaires,
                certificateur: certificateur, assets: assets, droits: droits, habilitations: tableauCertifFiltreAdminCountAll,
                participation: participation, habilitationsCertifiees: habilitationsCertifiees,
                habilitationsApprouvees: tableauCertifFiltreAdminCountApproved, habilitationsApprouveesPourcentage: habilitationsApprouveesPourcentage,
                habilitationsRejetees: tableauCertifFiltreAdminCountRemediated, habilitationsRejeteesPourcentage: habilitationsRejeteesPourcentage,
                habilitationsNonRevues: habilitationsNonRevues, habilitationsNonRevuesPourcentage: habilitationsNonRevuesPourcentage });
            } else {
                
                




                // AJOUTER UN ELEMENT DANS UN JSON
let celluleLocale5;
if(req.body.langue=='en'){
    celluleLocale5 = "of the local cell"
} else{
    celluleLocale5 = "de la cellule locale"
}

if (bodyCL === null) {
    const recupereLaCLDeLaPersonne5 = (await pool.query(sql_reqs['CLdeLaPersonne5'], [liste3[0]])).rows
    celluleLocale5 = recupereLaCLDeLaPersonne5[0].libelle
} else {
    celluleLocale5 = bodyCL
}

const tableauCertifFiltreClCountApprovedJson = (await pool.query(sql_reqs['tableauCertifFiltreCLCountApproved2'], [bodyDate, bodyCampagne, liste4])).rows
const tableauCertifFiltreClCountApproved2 = tableauCertifFiltreClCountApprovedJson[0].count
const tableauCertifFiltreClCountApprovedNotReviewedJson = (await pool.query(sql_reqs['tableauCertifFiltreCLCountApproved2NotReviewed'], [bodyDate, bodyCampagne, liste4])).rows
const tableauCertifFiltreClCountApprovedNotReviewed = tableauCertifFiltreClCountApprovedNotReviewedJson[0].count
// tableauCertifFiltreAdminCountApproved = tableauCertifFiltreAdminCountApproved2 * 1.0 + tableauCertifFiltreAdminCountApprovedNotReviewed * 1.0

const tableauCertifFiltreClCountRemediatedJson = (await pool.query(sql_reqs['tableauCertifFiltreCLCountRemediated2'], [bodyDate, bodyCampagne, liste4])).rows
const tableauCertifFiltreClCountRemediated2 = tableauCertifFiltreClCountRemediatedJson[0].count
const tableauCertifFiltreClCountRemediatedNotReviewedJson = (await pool.query(sql_reqs['tableauCertifFiltreCLCountRemediated2NotReviewed'], [bodyDate, bodyCampagne, liste4])).rows
const tableauCertifFiltreClCountRemediatedNotReviewed = tableauCertifFiltreClCountRemediatedNotReviewedJson[0].count

const tableauCertifFiltreClCountAllJson = (await pool.query(sql_reqs['tableauCertifFiltreCLCountAll2'], [bodyDate, bodyCampagne, liste4])).rows
const tableauCertifFiltreClCountAll2 = tableauCertifFiltreClCountAllJson[0].count

const achevementBis = tableauCertifFiltreClCountApproved2 * 1.0 + tableauCertifFiltreClCountRemediated2 * 1.0
const achevementNonArrondi = (achevementBis / tableauCertifFiltreClCountAll2) * 10000
const achevement = (Math.round(achevementNonArrondi)) / 100

const beneficiaireJson = (await pool.query(sql_reqs['beneficiaireCl2'], [bodyDate, bodyCampagne, liste4])).rows
const beneficiaire = beneficiaireJson[0].count
const certificateurJson = (await pool.query(sql_reqs['certificateurCl2'], [bodyDate, bodyCampagne, liste4])).rows
const certificateur = certificateurJson[0].count

            
        



const assetsJson = (await pool.query(sql_reqs['assetsCl2'], [bodyDate, bodyCampagne, liste4])).rows
const assets = assetsJson[0].count
const droitsJson = (await pool.query(sql_reqs['droitsCl2'], [bodyDate, bodyCampagne, liste4])).rows
const droits = droitsJson[0].count

const habilitationsCertifiees = tableauCertifFiltreClCountApproved2 * 1.0 + tableauCertifFiltreClCountRemediated2 * 1.0
const habilitationsApprouveesPourcentageNonArrondi = (tableauCertifFiltreClCountApproved2 / tableauCertifFiltreClCountAll2) * 10000
const habilitationsApprouveesPourcentage = (Math.round(habilitationsApprouveesPourcentageNonArrondi)) / 100

const habilitationsRejeteesPourcentageNonArrondi = (tableauCertifFiltreClCountRemediated2 / tableauCertifFiltreClCountAll2) * 10000
const habilitationsRejeteesPourcentage = (Math.round(habilitationsRejeteesPourcentageNonArrondi)) / 100

const habilitationsNonRevues = tableauCertifFiltreClCountApprovedNotReviewed * 1.0 + tableauCertifFiltreClCountRemediatedNotReviewed * 1.0
const habilitationsNonRevuesPourcentageNonArrondi = (habilitationsNonRevues / tableauCertifFiltreClCountAll2) * 10000
const habilitationsNonRevuesPourcentage = (Math.round(habilitationsNonRevuesPourcentageNonArrondi)) / 100

const recupProgressionCLJson = (await pool.query(sql_reqs['recupProgressionCL2'], [bodyDate, bodyCampagne, liste4])).rows
const recupProgressionCLNotRevJson = (await pool.query(sql_reqs['recupProgressionCL2NotRev'], [bodyDate, bodyCampagne, liste4])).rows

let participation;
if (recupProgressionCLNotRevJson.length === 0) {
    let divisionPartici = 0
    for(let op of recupProgressionCLJson) {
        divisionPartici += ((op.nombre_lignes_etat_closed * 1.0) / (op.nombre_total_lignes * 1.0)) * 100
    }
    let participationArrondir = ((divisionPartici * 1.0) / (recupProgressionCLJson.length * 1.0)) * 100
    participation = (Math.round(participationArrondir)) / 100
} else {
    let divisionPartici = 0
    for(let op of recupProgressionCLJson) {
        let entree = false
        for(let ik of recupProgressionCLNotRevJson) {
            if (ik.utilisateur === op.utilisateur && entree === false) {
                divisionPartici += (((op.nombre_lignes_etat_closed * 1.0) - (ik.nombre_lignes_etat_closed * 1.0)) / (op.nombre_total_lignes * 1.0)) * 100
                entree = true
            }
        }
        if (entree === false) {
            divisionPartici += ((op.nombre_lignes_etat_closed * 1.0) / (op.nombre_total_lignes * 1.0)) * 100
        }
    }
    let participationArrondir = ((divisionPartici * 1.0) / (recupProgressionCLJson.length * 1.0)) * 100
    participation = (Math.round(participationArrondir)) / 100
}
res.json({ poleBilan: celluleLocale5, achevement: achevement, beneficiaire: beneficiaire, certificateur: certificateur, assets: assets, droits: droits,
    habilitations: tableauCertifFiltreClCountAll2, participation: participation, habilitationsCertifiees: habilitationsCertifiees,
    habilitationsApprouvees: tableauCertifFiltreClCountApproved2, habilitationsApprouveesPourcentage: habilitationsApprouveesPourcentage,
    habilitationsRejetees: tableauCertifFiltreClCountRemediated2, habilitationsRejeteesPourcentage: habilitationsRejeteesPourcentage,
    habilitationsNonRevues: habilitationsNonRevues, habilitationsNonRevuesPourcentage: habilitationsNonRevuesPourcentage });
}
} catch (err) {
logs('/api/bilancertif/', err)
res.status(500).end()
}
})

// WebService pour générer le fichier csv pour un rapport de campagne de type Pôle du bénéficiaire
app.post('/api/ecart/:option/toExcel', async(req, res) => {
try {
    // DEBUT : calcul pour déterminer à quelle Cellule Appartient la personne
    const body1 = res.locals.userInfo.sub
    // const body1 = req.body.uid
    // liste 1 = []
    // liste 2 correspond aux libellés des équipes
    const liste1 = []
    const liste3 = []
    let i = 0

    const ret3 = (await pool.query(sql_reqs['v3listeCL'])).rows
    for (i; i < ret3.length; i++) {
        liste1[i] = ret3[i].code_unique;
    }
    liste1[ret3.length] = "ITG_MyAccess_Administrateur central";

    //CL auquel on est affecté
    const codeUniqueDesCLAuquelIlAppartient = (await pool.query(sql_reqs['v3_si_cl_ou_non'], [body1, liste1])).rows

    // IMPORTANT : POUR CHANGER DE CL ON DECOMENTE LA LIGNE SUIVANTE (en plaçant un code unique (équipe) de son choix) ET ON COMMENTE LA BOUCLE FOR let k = 0
    // liste3[0]="E-0000000180"
    // liste3[0]="E-0000001269"

    for (let k = 0; k < codeUniqueDesCLAuquelIlAppartient.length; k++) {
        liste3[k] = codeUniqueDesCLAuquelIlAppartient[k].code_unique
    }

    if(liste3.includes("ITG_MyAccess_Administrateur central")) {
        liste3[0] = "ITG_MyAccess_Administrateur central"
    }

    // FIN : Calcul pour déterminer à quelle Cellule Appartient la personne
if (liste3[0] === "ITG_MyAccess_Administrateur central") {

    // AJOUTER UN ELEMENT DANS UN JSON
    const reqBody = getData2(req);
    let query = knex('ecarts_myaccess_basehabi').where('date_trait', '=', req.params.option)
    Object.keys(reqBody).forEach(function(e) {
        query = query.whereLike(e, '%' + reqBody[e] + '%')
    })

    await reqExcel(query.select('uid', 'statut', 'manque_basehabi', 'manque_myaccess', 'date_trait', 'asset'),
        res, "Rapport des écarts entre BaseHabi1 et MyAccess")
}

// FIN : Cas Cellule Déploiement -> Générer Rapport csv
// DEBUT : Cas Cellule Locale -> Générer Rapport csv
else {
    logs('/api/ecart/:option/toExcel/', err)
    res.status(500).end()
}

// FIN : Cas Cellule Locale -> Générer Rapport csv
}catch (err) {
    logs('/api/ecart/:option/toExcel/', err)
    res.status(500).end()
}
})

// webservice pour générer le rapport de campagne de type Pôle du bénéficiaire
app.post('/api/ecart/:option/:offset/:limit/', async(req, res) => {
    try {
        const offsetLimit = formatOffsetLimit(req.params.offset, req.params.limit);
        // DEBUT : calcul pour déterminer à quelle Cellule Appartient la personne
        const body1 = res.locals.userInfo.sub
        // const body1 = req.body.uid
        // liste 1 = []
        // liste 2 correspond aux libellés des équipes
        const liste1 = []
        const liste3 = []
        let i = 0
        const ret3 = (await pool.query(sql_reqs['v3listeCL'])).rows
        for (i; i < ret3.length; i++) {
            liste1[i] = ret3[i].code_unique;
        }
        liste3[ret3.length] = "ITG_MyAccess_Administrateur central";

        //CL auquel on est affecté
        const codeUniqueDesCLAuquelIlAppartient = (await pool.query(sql_reqs['v3_si_cl_ou_non'], [body1, liste1])).rows
        
        // IMPORTANT : POUR CHANGER DE CL ON DECOMENTE LA LIGNE SUIVANTE (en plaçant un code unique (équipe) de son choix) ET ON COMMENTE LA BOUCLE FOR let k = 0
        // liste3[0]="E-0000000180"
        // liste3[0]="E-0000016269"
        
        let p = 0
        for (p; p < codeUniqueDesCLAuquelIlAppartient.length; p++) {
            liste3[p] = codeUniqueDesCLAuquelIlAppartient[p].code_unique
        }
        
        if(liste3.includes("ITG_MyAccess_Administrateur central")) {
            liste3[0] = "ITG_MyAccess_Administrateur central"
        }
        
        // FIN : Calcul pour déterminer à quelle Cellule Appartient la personne
        // DEBUT : Cas Cellule Déploiement
        if (liste3[0] === "ITG_MyAccess_Administrateur central") {
            // AJOUTER UN ELEMENT DANS UN JSON
            const reqBody = getData2(req);
            let query = knex('ecarts_myaccess_basehabi').where('date_trait', '=', req.params.option)
            Object.keys(reqBody).forEach(function(e) {
                query = query.whereLike(e, '%' + reqBody[e] + '%')
            })
            res.json({
                objects: (await query.clone()
                    .select('uid', 'statut', 'manque_basehabi', 'manque_myaccess', 'date_trait')
                    .offset(offsetLimit[0]).limit(offsetLimit[1])
                ),
                objects1: (await query.clone()
                    .select('uid', 'statut', 'manque_basehabi', 'manque_myaccess', 'date_trait', 'asset')
                    .offset(offsetLimit[0]).limit(offsetLimit[1])
                ),
                count: (await query.clone().count())
            });
        
            // FIN : Cas Cellule Déploiement
            // DEBUT : Cas Cellule Locale
        } else {
            logs('/api/v3certificationStage1/:option/:offset/:limit', err)
            res.status(500).end()
        }
        // FIN : Cas Cellule Locale
    }catch (err) {
    logs('/api/v3certificationStage1/option/offset/limit', err)
    res.status(500).end()
}
})
/* MODIFIED ZONE D-- */
/*--------------------*/

/* ENDPOINT GET : retrieve users with rights */

app.post('/api/users/:option/:offset/:limit', async(req, res) => 
{
    try 
    {
        let uid = res.locals.userInfo.sub
        // const uid = req.body.uid

        const cellule_centrale = (await pool.query(sql_reqs['cellule_centrale_check'], [uid])).rows[0].res != '0';

        let pole_ = await get_cellule_local_poles(uid)

        /*pas de droit cellule centrale ni dans une cellule locale -> acces interdit*/
        if (!cellule_centrale && pole_ === undefined) 
        {
            res.status(403).end()
        }

        /*fix : ajout du cast pr mettre count en string pr comparaison filtrage */
        let users_ = knex('users_300_rights')

        const liste1 = []
        const liste3 = []
        let i = 0

        const ret3 = (await pool.query(sql_reqs['v3listeCL'])).rows
        for (i; i < ret3.length; i++) {
            liste1[i] = ret3[i].code_unique;
        }
        liste1[ret3.length] = "ITG_MyAccess_Administrateur central";



        const codeUniqueDesCLAuquelIlAppartient = (await pool.query(sql_reqs['v3_si_cl_ou_non'], [uid, liste1])).rows

let p = 0
for (p; p < codeUniqueDesCLAuquelIlAppartient.length; p++) {
    liste3[p] = codeUniqueDesCLAuquelIlAppartient[p].code_unique;
}

if(liste3.includes("ITG_MyAccess_Administrateur central")) {
    liste3[0] = "ITG_MyAccess_Administrateur central"
}

/*si cellule centrale on montre tt dc on laisse users_ tel quel; sinon on réduit les users a ceux qui font partie de sa cellule locale */
if (liste3[0] !== "ITG_MyAccess_Administrateur central") {
    const recuperePoleDeLaPersonne = (await pool.query(sql_reqs['poleDeLaPersonne'], [liste3[0]])).rows
    let poleDeLaPersonne = []
    for (let m = 0; m < recuperePoleDeLaPersonne[0].poles.length; m++) {
        poleDeLaPersonne[m] = recuperePoleDeLaPersonne[0].poles[m]
    }
    /*poleDeLaPersonne contient liste des poles associes a la cellule locale*/
    users_ = users_.whereIn('pole', poleDeLaPersonne);
}

const offsetLimit = formatOffsetLimit(req.params.offset, req.params.limit);

/*fix pb de filtrage sur les colonnes autres que celles de identities :) */
if (req.body['eid']!==undefined){
    req.body['habilitations.eid']=req.body.eid;
    delete req.body.eid;
}
if (req.body['display_name']!==undefined){
    req.body['habilitations.display_name']=req.body.display_name;
    delete req.body.display_name;
}










//where filtering occurs (filtering strings are contained in req.body)
Object.keys(req.body).forEach(function(e) {
    users_ = users_.whereLike(e, '%' + req.body[e] + '%')
})

const recupereNbUsersPlus300Droits = (await pool.query(sql_reqs['nbusersPlus300Droits'])).rows

res.json({
    objects: (await users_._clone().select('*')
        //.where(knex.raw('CAST(count as bigint) > 0'))
        .orderBy('pole').offset(offsetLimit[0]).limit(offsetLimit[1])
    ),
    count: await recupereNbUsersPlus300Droits
    // res.json(users_)
})

}catch(err){
    logs('/api/users/', err);
    res.status(500).end()
}
})

app.post('/api/users/:option/toExcel', async(req, res) => 
{
    try 
    {
        const recupereUsersPlus300Droits = (await pool.query(sql_reqs['usersPlus300Droits'])).rows.map(e => e.uid)
        //let users_ = knex('rapporthabilitation').select('*').whereIn('uid', recupereUsersPlus300Droits).select(knex.raw("case when type_droit='it' then 'Droit' when type_droit ..."))
        let users_ = knex('rapporthabilitation')
            .select('uid as ID beneficiaire', 'beneficiaire as Nom Complet Beneficiaire', 'code_uo as Code uo')
            .select('uo as Libelle UO', 'libelle_metier as Libelle Metier', 'pole as pole principal')
            .select('etat_utilisateur as Etat utilisateur', 'sensibilite as Sensibilite')
            .select('statut_droit as Statut du droit', 'start_date as Date de debut', 'end_date as Date de fin', 'right_id as Code du droit',
                'libelle_droit as Libelle du droit')
            .select(knex.raw("case when type_droit='it' then 'Droit' when type_droit='bnpp_equipe' then 'equipe' else 'Profil metier' end as type_droit"))
            .select('code_iam as Code IAM', 'asset as Libelle de l\'asset', 'code_ap as Code AP', 'perimetre_01 as Valeur Perimetre 1',
                'perimetre_02 as Valeur Perimetre 2', 'perimetre_03 as Valeur Perimetre 3', 'perimetre_04 as Valeur Perimetre 4',
                'perimetre_05 as Valeur Perimetre 5', 'perimetre_06 as Valeur Perimetre 6', 'perimetre_07 as Valeur Perimetre 7',
                'perimetre_08 as Valeur Perimetre 8')
            .select('roles_list_of_profil as Liste des droits PN')
            .whereIn('uid', recupereUsersPlus300Droits)
        
        const body1 = res.locals.userInfo.sub
        // const body1 = req.body.uid
        
        const liste1 = []
        const liste3 = []
        let i = 0
        
        const ret3 = (await pool.query(sql_reqs['v3listeCL'])).rows
        for (i; i < ret3.length; i++) {
            liste1[i] = ret3[i].code_unique;
        }
        liste1[ret3.length] = "ITG_MyAccess_Administrateur central";
        
        const codeUniqueDesCLAuquelIlAppartient = (await pool.query(sql_reqs['v3_si_cl_ou_non'], [body1, liste1])).rows
        
        let p = 0
        for (p; p < codeUniqueDesCLAuquelIlAppartient.length; p++) {
            liste3[p] = codeUniqueDesCLAuquelIlAppartient[p].code_unique
        }
        
        if(liste3.includes("ITG_MyAccess_Administrateur central")) {
            liste3[0] = "ITG_MyAccess_Administrateur central"
        }
        
        if (liste3[0] !== "ITG_MyAccess_Administrateur central") {
            const recuperePoleDeLaPersonne = (await pool.query(sql_reqs['poleDeLaPersonne'], [liste3[0]])).rows
            let poleDeLaPersonne = []
            for (let m = 0; m < recuperePoleDeLaPersonne[0].poles.length; m++) {
                poleDeLaPersonne[m] = recuperePoleDeLaPersonne[0].poles[m]
            }
        














            users_ = users_.whereIn('pole', poleDeLaPersonne);

        }

await reqExcel(users_, res, 'Rapport des utilisateurs ayant plus de 300 habilitations');
} 
catch(err) 
{
    logs('/api/users/', err);
    res.status(500).end();
}
})


app.get('/api/droits', async(_req, res) => 
{
    try 
    {
        //const users_ = await knex.select('*').from('habilitations');
        const users_ = await knex('identities')
            .distinct('habilitations.eid', 'habilitations.display_name', 'identities.pole', 'subquery.count as count')
            .join('habilitations', 'habilitations.eid', 'identities.eid')
            .join('droits', 'habilitations.code_unique', 'droits.code_unique')
            .join(knex('habilitations').select('eid').count('* as count').groupBy('eid').as('subquery'), 'habilitations.eid', 'subquery.eid')
            .where('subquery.count', '>', '300')

        const userEidsEph = users_.map(user => user.eid)
        const userEids = users_.map(user => user.eid)

        const concat_droits = [];

        while(userEidsEph.length != 0){
            let id_myaccess = await knex.select('droits.libelle').from('droits').join('habilitations', 'droits.code_unique', 'habilitations.code_unique')
                .where('habilitations.eid', '=', userEidsEph[0]);

            let nom_asset = await knex.select('droits.libelle_asset').from('droits').join('habilitations', 'droits.code_unique', 'habilitations.code_unique')
                .where('habilitations.eid', '=', userEidsEph[0]);







                let concatened_ = [];
for (i = 0; i < nom_asset[1]!==undefined; i++) {
    /*fix passage de l id my access au nom du droit */
    concatened_ += `${nom_asset[1].libelle_asset} : ${id_myaccess[1].libelle[id_myaccess[1].libelle.length-1].value} \n\n `;
}

concat_droits.push(concatened_);
//let concatened = `${id_myaccess[0].id_habi} : ${nom_asset[0].libelle_asset}`;

//console.log(id_myaccess);

userEidsEph.shift();
        }
//console.log(concat_droits);

const UserRightObj = {};

for(i=0; i < userEids.length; i++)
{
    const user = userEids[i];
    const rights = concat_droits[i];
    UserRightObj[user]=rights;
}

//console.log(UserRightObj['200396']);

res.json(UserRightObj); //['200134']
//res.status(403).end();
//res.send("This is a test")
} 
    
catch(err)
{
    logs('/api/droits/', err);
    res.status(500).end();
}

})







async function getSOD(option, res, type, offset = null, limit = null, bodyFilter = {}) {
    const bodyFilterEmpty = Object.keys(bodyFilter).length === 0
    let retu, retu2, retcl, retcl2;
    if (offset != null && limit != null) {
        retcl = knex('sod').limit(limit).offset(offset)
        retcl2 = knex('sod')
    } else {
        retcl = knex('sod')
        retcl2 = knex('sod')
    }
    if(!bodyFilterEmpty) {
        Object.keys(bodyFilter).forEach(function(e) {
            if (e == 'id') {
                retu = retcl.whereRaw('CAST(' + e + ' AS TEXT) LIKE ?', ['%' + bodyFilter[e] + '%'])
                retu2 = retcl2.whereRaw('CAST(' + e + ' AS TEXT) LIKE ?', ['%' + bodyFilter[e] + '%'])
            } else {
                retu = retcl.whereLike(e, '%' + bodyFilter[e] + '%')
                retu2 = retcl2.whereLike(e, '%' + bodyFilter[e] + '%')
            }
        })
    } else{
        retu = retcl
        retu2 = retcl2
    }
    return {
        'objects': (await retu.clone()
            .select('libelle_politique_sod', 'libelle_regle', 'gestionnaire_politique_sod', 'proprietaire_regle', 'description_regle', 'groupe_1_code_unique',
                'groupe_1_libelle_droit', 'groupe_2_code_unique', 'groupe_2_libelle_droit')),
        'count': (await retu2.clone().count())
    }
}

async function getSODIWM(option, res, type, offset = null, limit = null, bodyFilter = {}) {
    const bodyFilterEmpty = Object.keys(bodyFilter).length === 0
    let retu, retu2, retcl, retcl2;

    const getResultWithPagination = (table) => {
        if(offset != null && limit != null) {
            retcl = knex(table).limit(limit).offset(offset)
            retcl2 = knex(table)
        } else {
            retcl = knex('sodview')
            retcl2 = knex('sodview')
        }
        return (retcl, retcl2)
    }
    
    if (!bodyFilterEmpty) {
        if (bodyFilter.groupe_1_code_unique != null || bodyFilter.groupe_1_libelle_droit != null || bodyFilter.groupe_2_libelle_droit != null || bodyFilter.groupe_2_code_unique != null){
            getResultWithPagination('sodview')
        } else{
            getResultWithPagination('sodviewihm')
        }
        Object.keys(bodyFilter).forEach(function(e) {
            if (e == 'id') {
                retu = retcl.whereRaw('CAST(' + e + ' AS TEXT) LIKE ?', ['%' + bodyFilter[e] + '%'])
                retu2 = retcl2.whereRaw('CAST(' + e + ' AS TEXT) LIKE ?', ['%' + bodyFilter[e] + '%'])
            } else {
                retu = retcl.whereLike(e, '%' + bodyFilter[e] + '%')
                retu2 = retcl2.whereLike(e, '%' + bodyFilter[e] + '%')
            }
        })
    } else{
        getResultWithPagination('sodviewhm');
        retu = retcl
        retu2 = retcl2
    }
    return {
        'objects': (await retu.clone()
            .select('libelle_politique_sod', 'libelle_regle', 'gestionnaire_politique_sod', 'proprietaire_regle', 'description_regle', 'groupe_1_code_unique',
                'groupe_1_libelle_droit', 'groupe_2_code_unique', 'groupe_2_libelle_droit', 'numgrpcodeunique', 'num2grpcodeunique', 'id_rule')),
        'count': (await retu2.clone().count())
    }
}
    async function getSODetail(idrule){
        let retu, retcl;
    
    













        retcl = knex('sod').where('id_rule', idrule)
        retu = retcl
        return {
            'objects1': (await retu.clone()
                .select('groupe_1_code_unique', 'groupe_1_libelle_droit').distinct()),
            'objects2': (await retu.clone()
                .select('groupe_2_code_unique', 'groupe_2_libelle_droit').distinct())
        }
    }
    
    app.get('/api/authentc1', async(req, res) => {
        try {
            // DEBUT : Calcul pour déterminer à quelle Cellule Appartient la personne
            const body1 = res.locals.userInfo.sub
    
            //liste 1 correspond aux idcodes uniques des équipes
            const liste1 = []
            const liste3 = []
            // liste 4 liste recensant les droits d’une CL Gest
            let i = 0
    
            const ret3 = (await pool.query(sql_reqs['v3listeCL'])).rows
            for (i; i < ret3.length; i++) {
                liste1[i] = ret3[i].code_unique;
            }
            liste1[ret3.length] = "ITG_MyAccess_Administrateur central";
    
            //CL auquel on est affecté
            const codeUniqueDesCLAuquelIlAppartient = (await pool.query(sql_reqs['v3_si_cl_ou_non'], [body1, liste1])).rows
    
            for (let k = 0; k < codeUniqueDesCLAuquelIlAppartient.length; k++) {
                liste3[k] = codeUniqueDesCLAuquelIlAppartient[k].code_unique;
            }
    
            if(liste3.includes("ITG_MyAccess_Administrateur central")) {
                liste3[0] = "ITG_MyAccess_Administrateur central"
            }






            if(liste3[0] === "ITG_MyAccess_Administrateur central") {
                res.json(liste3[0])
            }
            else{
                const CLName = (await pool.query(sql_reqs['cl_translation'], [liste3[0]])).rows
                res.json(CLName[0].libelle_droit)
            }
            
        }catch(err){
                logs('/api/cert/certif3/requests_options4', err)
                res.status(500).end()
            }
        })
            /*-------------------------*/
            /* MODIFIED ZONE D-- */
            
            /* Calcul de la participation par pôle, habilitations revues par pôle et statistique par semaine */
            app.post('/api/bilancertifPartie2', async(req, res) => {
                try {
                    const body1 = res.locals.userInfo.sub
                    // const body1 = req.body.uid
            
                    const liste1 = []
                    //liste 2 correspond aux libellés des équipes
                    const liste3 = []
                    // liste 4 liste recensant les droits d'une CL Gest
                    let liste4 = []
                    let i = 0
            
                    const ret3 = (await pool.query(sql_reqs['v3listeCL'])).rows
                    for (i; i < ret3.length; i++) {
                        liste1[i] = ret3[i].code_unique;
                    }
                    liste1[ret3.length] = "ITG_MyAccess_Administrateur central";
            
                    const codeUniqueDesCLAuquelIlAppartient = (await pool.query(sql_reqs['v3_si_cl_ou_non'], [body1, liste1])).rows
            
                    //IMPORTANT : POUR CHANGER DE CL ON DECOMENTE LA LIGNE SUIVANTE (en plaçant un code unique (équipe) de son choix) ET ON COMMENTE LA BOUCLE FOR let k = 0
                    //liste3[0]="E-0000000180"
            
                    for (let k = 0; k < codeUniqueDesCLAuquelIlAppartient.length; k++) {
                        liste3[k] = codeUniqueDesCLAuquelIlAppartient[k].code_unique
                    }
            

                    if(liste3.includes("ITG_MyAccess_Administrateur central")) {
                        liste3[0] = "ITG_MyAccess_Administrateur central"
                    }
                    
                    const recupereLaCLDeLaPersonne = (await pool.query(sql_reqs['CLdeLaPersonne'], [liste3[0]])).rows
                    const poleDeLaPersonne = recupereLaCLDeLaPersonne[0].libelle[0].value
                    
                    const listeDroitsDeLACLGestionnaire = (await pool.query(sql_reqs['v3listeDroitsDeLACLGestionnaire2'], [poleDeLaPersonne])).rows
                    
                    for (let j = 0; j < listeDroitsDeLACLGestionnaire.length; j++) {
                        liste4[j] = listeDroitsDeLACLGestionnaire[j].code_unique
                    }
                    
                    const bodyDate = req.body.anne;
                    const bodyCampagne = req.body.campagne;
                    const bodyCL = req.body.cl;
                    if (bodyCL != null) {
                        const listeDroitsDeLACLGestionnaire = (await pool.query(sql_reqs['v3listeDroitsDeLACLGestionnaire2'], [bodyCL])).rows
                        for (let jj = 0; jj < listeDroitsDeLACLGestionnaire.length; jj++) {
                            liste4[jj] = listeDroitsDeLACLGestionnaire[jj].code_unique
                        }
                        liste3[0] = bodyCL
                    }
                    
                    if (liste3[0] === "ITG_MyAccess_Administrateur central") {
                        // PARTICIPATION PAR POLE
                    
                        const recupPoleBenefDistinctJson = (await pool.query(sql_reqs['recupPoleBenefDistinct'], [bodyDate, bodyCampagne])).rows
                        const recupProgressionParPoleJson = (await pool.query(sql_reqs['participationParPolecelCentrale'], [bodyDate, bodyCampagne])).rows
                        const recupProgressionParPoleNotReviewJson = (await pool.query(sql_reqs['participationParPoleCelCentraleNotReview'], [bodyDate, bodyCampagne])).rows
                    
                        const participationPole = []
                        const participationNombreLignesMoyenne = []
                        if(recupProgressionParPoleNotReviewJson.length === 0) {
                            for (let or = 0; or < recupPoleBenefDistinctJson.length; or++) {
                                let nombre_lignes_moyenne_compteur = 0
                                let note_total_moyenne = 0
                                for(let oq of recupProgressionParPoleJson) {
                                    let consta = 0
                                    let constb = 0
                                    let moyenneab = 0
                                    if (recupPoleBenefDistinctJson[or].pole_du_beneficiaire === oq.pole_du_beneficiaire) {
                                        consta = oq.nombre_lignes_etat_closed
                                        constb = oq.nombre_total_lignes
                                        moyenneab = consta / constb
                                        note_total_moyenne += moyenneab
                                        nombre_lignes_moyenne_compteur++
                                    }
                                }
                                participationPole[or] = recupPoleBenefDistinctJson[or].pole_du_beneficiaire
                                const arrondi = ((note_total_moyenne * 1.0) / (nombre_lignes_moyenne_compteur * 1.0)) * 10000
                                participationNombreLignesMoyenne[or] = (Math.round(arrondi)) / 100
                            }
                        } else {
                            for (let or = 0; or < recupPoleBenefDistinctJson.length; or++) {
                                let nombre_lignes_moyenne_compteur = 0
                                let note_total_moyenne = 0
                                for(let oq of recupProgressionParPoleJson) {
                                    let consta = 0
                                    let constb = 0
                                    let moyenneab = 0
                                    let verif = "false"
                                    for(let ty of recupProgressionParPoleNotReviewJson) {
                                        if (recupPoleBenefDistinctJson[or].pole_du_beneficiaire === oq.pole_du_beneficiaire) {
                                            if (ty.utilisateur === oq.utilisateur && ty.pole_du_beneficiaire === oq.pole_du_beneficiaire && verif === "false") {
                                                consta = oq.nombre_lignes_etat_closed - ty.nombre_lignes_etat_closed
                                                constb = oq.nombre_total_lignes
                                                moyenneab = consta / constb
                                                note_total_moyenne += moyenneab
                                                nombre_lignes_moyenne_compteur++
                                                verif = "true"
                                            }
                                        }
                                    }
                                    if (verif === "false" && recupPoleBenefDistinctJson[or].pole_du_beneficiaire === oq.pole_du_beneficiaire) {
                                        consta = oq.nombre_lignes_etat_closed
                                        constb = oq.nombre_total_lignes
                                        moyenneab = consta / constb
                                        note_total_moyenne += moyenneab
                                        nombre_lignes_moyenne_compteur++
                                    }
                                }
                        



                                participationPole[or] = recupPoleBenefDistinctJson[or].pole_du_beneficiaire
                                const arrondi = ((note_total_moyenne * 1.0) / (nombre_lignes_moyenne_compteur * 1.0)) * 10000
                                participationNombreLignesMoyenne[or] = (Math.round(arrondi)) / 100
                            }
                        }
                        
                        // HABILITATIONS REVUE PAR POLE
                        const recupHabilitationParPoleJson = (await pool.query(sql_reqs['recupProgressionParPole'], [bodyDate, bodyCampagne])).rows
                        const recupHabilitationParPoleNotReviewJson = (await pool.query(sql_reqs['recupProgressionParPoleNotReview'], [bodyDate, bodyCampagne])).rows
                        
                        let habilitationPole = []
                        let habilitationNombrelignesClosed = []
                        let habilitationNombreTotal = []
                        if (recupHabilitationParPoleNotReviewJson.length === 0) {
                            for (let on = 0; on < recupHabilitationParPoleJson.length; on++) {
                                habilitationPole[on] = recupHabilitationParPoleJson[on].pole_du_beneficiaire
                                habilitationNombrelignesClosed[on] = recupHabilitationParPoleJson[on].nombre_lignes_etat_closed
                                habilitationNombreTotal[on] = recupHabilitationParPoleJson[on].nombre_total_lignes
                            }
                        } else {
                            for (let on = 0; on < recupHabilitationParPoleJson.length; on++) {
                                let verifie = false
                                for (let nbv of recupHabilitationParPoleNotReviewJson) {
                                    if (recupHabilitationParPoleJson[on].pole_du_beneficiaire === nbv.pole_du_beneficiaire) {
                                        habilitationPole[on] = recupHabilitationParPoleJson[on].pole_du_beneficiaire
                                        habilitationNombrelignesClosed[on] = recupHabilitationParPoleJson[on].nombre_lignes_etat_closed - nbv.nombre_lignes_etat_closed
                                        habilitationNombreTotal[on] = recupHabilitationParPoleJson[on].nombre_total_lignes
                                        verifie = true
                                    }
                                }
                                if (verifie === false) {
                                    habilitationPole[on] = recupHabilitationParPoleJson[on].pole_du_beneficiaire
                                    habilitationNombrelignesClosed[on] = recupHabilitationParPoleJson[on].nombre_lignes_etat_closed
                                    habilitationNombreTotal[on] = recupHabilitationParPoleJson[on].nombre_total_lignes
                                }
                            }
                        }
                        


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
//RESULTAT HAB


res.json({ partiePole: participationPole, partieCompteurPole: participationNombreLignesMoyenne, partieCompteurTotal: participationCompteurTotal, 
    partie2Pole: habilitationPole, partie2CompteurPole: habilitationNombrelignesClosed, partie2CompteurTotal: habilitationNombreTotal });

} else {

const recupPoleBenefDistinctJson = (await pool.query(sql_reqs['recupPoleBenefDistinct'], [bodyDate, bodyCampagne, liste4])).rows
const recupProgressionParPoleJson = (await pool.query(sql_reqs['participationParPoleCellocale'], [bodyDate, bodyCampagne, liste4])).rows
const recupProgressionParPoleNotReviewJson = (await pool.query(sql_reqs['participationParPoleCellocaleNotReview'], [bodyDate, bodyCampagne, liste4])).rows

const participationPole = []
const participationNombreLignesMoyenne = []
if(recupProgressionParPoleNotReviewJson.length === 0) {
    for (let or = 0; or < recupPoleBenefDistinctJson.length; or++) {
        let nombre_lignes_moyenne_compteur = 0
        let nombre_total_moyenne = 0
        for(let oq of recupProgressionParPoleJson) {
            let consta = 0
            let constb = 0
            let moyenneab = 0
            if(recupPoleBenefDistinctJson[or].pole_du_beneficiaire === oq.pole_du_beneficiaire) {
                consta = oq.nombre_lignes_etat_closed
                constb = oq.nombre_total_lignes
                moyenneab = consta / constb
                nombre_total_moyenne += moyenneab
                nombre_lignes_moyenne_compteur++
            }
        }
        participationPole[or] = recupPoleBenefDistinctJson[or].pole_du_beneficiaire
        const arrondi = ((nombre_total_moyenne * 1.0) / (nombre_lignes_moyenne_compteur * 1.0)) * 10000
        participationNombreLignesMoyenne[or] = (Math.round(arrondi)) / 100
    }
} else {
    for (let or = 0; or < recupPoleBenefDistinctJson.length; or++) {
        let nombre_lignes_moyenne_compteur = 0
        let nombre_total_moyenne = 0
        for(let oq of recupProgressionParPoleJson) {
            let consta = 0
            let constb = 0
            let moyenneab = 0

            let verif = false
            for(let ty of recupProgressionParPoleNotReviewJson) {
                if (recupPoleBenefDistinctJson[or].pole_du_beneficiaire === oq.pole_du_beneficiaire) {
                    if (ty.utilisateur === oq.utilisateur && ty.pole_du_beneficiaire === oq.pole_du_beneficiaire && verif === false) {
                        consta = oq.nombre_lignes_etat_closed - ty.nombre_lignes_etat_closed
                        constb = oq.nombre_total_lignes
                        moyenneab = consta / constb
                        nombre_total_moyenne += moyenneab
                        nombre_lignes_moyenne_compteur++
                        verif = true
                    }
                }
            }
            if (verif === false && recupPoleBenefDistinctJson[or].pole_du_beneficiaire === oq.pole_du_beneficiaire) {
                consta = oq.nombre_lignes_etat_closed
                constb = oq.nombre_total_lignes
                moyenneab = consta / constb
                nombre_total_moyenne += moyenneab
                nombre_lignes_moyenne_compteur++
            }
        }
        participationPole[or] = recupPoleBenefDistinctJson[or].pole_du_beneficiaire
        const arrondi = ((nombre_total_moyenne * 1.0) / (nombre_lignes_moyenne_compteur * 1.0)) * 10000
        participationNombreLignesMoyenne[or] = (Math.round(arrondi)) / 100
    }
} 
    const recupHabilitationParPoleJson = (await pool.query(sql_reqs['recupProgressionParPole2'], [bodyDate, bodyCampagne, liste4])).rows
    const recupHabilitationParPoleNotReviewJson = (await pool.query(sql_reqs['recupProgressionParPole2NotReview'], [bodyDate, bodyCampagne, liste4])).rows
    
    const habilitationPole = []
    const habilitationNombrelignesClosed = []
    const habilitationNombreTotal = []
    if(recupHabilitationParPoleNotReviewJson.length === 0) {
        for (let on = 0; on < recupHabilitationParPoleJson.length; on++) {
            habilitationPole[on] = recupHabilitationParPoleJson[on].pole_du_beneficiaire
            habilitationNombrelignesClosed[on] = recupHabilitationParPoleJson[on].nombre_lignes_etat_closed
            habilitationNombreTotal[on] = recupHabilitationParPoleJson[on].nombre_total_lignes
        }
    } else {
        for (let on = 0; on < recupHabilitationParPoleJson.length; on++) {
            let verifie = false
            for(let nbv of recupHabilitationParPoleNotReviewJson) {
                if (recupHabilitationParPoleJson[on].pole_du_beneficiaire === nbv.pole_du_beneficiaire) {
                    habilitationPole[on] = recupHabilitationParPoleJson[on].pole_du_beneficiaire
                    habilitationNombrelignesClosed[on] = recupHabilitationParPoleJson[on].nombre_lignes_etat_closed - nbv.nombre_lignes_etat_closed
                    habilitationNombreTotal[on] = recupHabilitationParPoleJson[on].nombre_total_lignes
                    verifie = true
                }
            }
            if (verifie === false) {
                habilitationPole[on] = recupHabilitationParPoleJson[on].pole_du_beneficiaire
                habilitationNombrelignesClosed[on] = recupHabilitationParPoleJson[on].nombre_lignes_etat_closed
                habilitationNombreTotal[on] = recupHabilitationParPoleJson[on].nombre_total_lignes
            }
        }
    }
    
    /////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////:
    //RESULTAT HAB
    res.json({ partiePole: participationPole, partieCompteurPole: participationNombreLignesMoyenne, partieCompteurTotal: participationCompteurTotal, 
        partie2Pole: habilitationPole, partie2CompteurPole: habilitationNombrelignesClosed, partie2CompteurTotal: habilitationNombreTotal });
    
    }// <-- Fin beneficiaire et son pole

    } catch (err) {
        logs('/api/bilancertifPartie2', err)
        res.status(500).end()
    }
})
    // Web service pour récupérer les pourcentages d’achèvement de chaque cellule locale. Ces données peuvent être visibles en tant que Cellule Déploiement
    app.post('/api/bilancertifPartie3', async(req, res) => {
        try {
            const body1 = res.locals.userInfo.sub
            // const body1 = req.body.uid
    
            const liste1 = []
            //liste 2 correspond aux libellés des équipes
    








            const liste3 = []
//liste 4 liste recensant les droits d’une CL Gest
let i = 0

const ret3 = (await pool.query(sql_reqs['v3listeCL'])).rows
for (i; i < ret3.length; i++) {
    liste1[i] = ret3[i].code_unique;
}
liste1[ret3.length] = "ITG_MyAccess_Administrateur central";

const codeUniqueDesCLAuquelIlAppartient = (await pool.query(sql_reqs['v3_si_cl_ou_non'], [body1, liste1])).rows

//IMPORTANT : POUR CHANGER DE CL ON DECOMENTE LA LIGNE SUIVANTE (en plaçant un code unique (équipe) de son choix) ET ON COMMENTE LA BOUCLE FOR let k = 0
//liste3[0]="E-0000000180"

for (let k = 0; k < codeUniqueDesCLAuquelIlAppartient.length; k++) {
    liste3[k] = codeUniqueDesCLAuquelIlAppartient[k].code_unique;
}

if(liste3.includes("ITG_MyAccess_Administrateur central")) {
    liste3[0] = "ITG_MyAccess_Administrateur central"
}

const bodyDate = req.body.ann;
const bodyCampagne = req.body.campagne;

if (liste3[0] === "ITG_MyAccess_Administrateur central") {
    const AllCelluleLocaleJson = (await pool.query(sql_reqs['get_AllCelluleLocale'])).rows
    const AllCelluleLocale = []
    const listeDroitCelluleLocale = []
    const achevementCL = []
    const achevementCL2 = []

    for (let jpm = 0; jpm < AllCelluleLocaleJson.length; jpm++) {
        const droitCL = []
        AllCelluleLocale[jpm] = AllCelluleLocaleJson[jpm].libelle
        const droitclJson = (await pool.query(sql_reqs['v3listeDroitsDeLacLGestionnaire2'], [AllCelluleLocaleJson[jpm].libelle])).rows
        for (let jps = 0; jps < droitclJson.length; jps++) {
            droitCL[jps] = droitclJson[jps].code_unique
        }



        listeDroitCelluleLocale[jpm] = droitCL

        const tableauCertifFiltredAdminCountApprovedJson = (await pool.query(sql_reqs['tableauCertifFiltredCLCountApproved2'], [bodyDate, bodyCampagne, droitCL])).rows
        const tableauCertifFiltredAdminCountApproved2 = tableauCertifFiltredAdminCountApprovedJson[0].count
        const tableauCertifFiltredAdminCountApprovedNotReviewedJson = (await pool.query(sql_reqs['tableauCertifFiltredCLCountApproved2NotReviewed'], [bodyDate, bodyCampagne, droitCL])).rows
        const tableauCertifFiltredAdminCountApprovedNotReviewed = tableauCertifFiltredAdminCountApprovedNotReviewedJson[0].count
        const tableauCertifFiltredAdminCountApproved = tableauCertifFiltredAdminCountApproved2 * 1.0 - tableauCertifFiltredAdminCountApprovedNotReviewed * 1.0
        const tableauCertifFiltredAdminCountRemediatedJson = (await pool.query(sql_reqs['tableauCertifFiltredCLCountRemediated2'], [bodyDate, bodyCampagne, droitCL])).rows
        const tableauCertifFiltredAdminCountRemediated2 = tableauCertifFiltredAdminCountRemediatedJson[0].count
        const tableauCertifFiltredAdminCountRemediatedNotReviewedJson = (await pool.query(sql_reqs['tableauCertifFiltredCLCountRemediated2NotReviewed'], [bodyDate, bodyCampagne, droitCL])).rows
        const tableauCertifFiltredAdminCountRemediatedNotReviewed = tableauCertifFiltredAdminCountRemediatedNotReviewedJson[0].count
        const tableauCertifFiltredAdminCountRemediated = tableauCertifFiltredAdminCountRemediated2 * 1.0 - tableauCertifFiltredAdminCountRemediatedNotReviewed * 1.0
        const tableauCertifFiltredAdminCountAllJson = (await pool.query(sql_reqs['tableauCertifFiltredCLCountAll2'], [bodyDate, bodyCampagne, droitCL])).rows
        const tableauCertifFiltredAdminCountAll = tableauCertifFiltredAdminCountAllJson[0].count
        const achievementNobis = tableauCertifFiltredAdminCountApproved * 1.0 + tableauCertifFiltredAdminCountRemediated * 1.0
        const achievementNonArrondi = (achievementNobis / tableauCertifFiltredAdminCountAll) * 10000
        const achievement = (Math.round(achievementNonArrondi)) / 100
        achevementCL2[jpm] = { achievement: achievement, listeCL: AllCelluleLocale[jpm] }
    }

    for (let i = 0; i < achevementCL2.length; i++) {
        if (!isNaN(achevementCL2[i].achievement)) {
            achevementCL.push(achevementCL2[i])
        }
    }

    res.json(achevementCL)
} else {
    // AJOUTER UN ELEMENT DANS UN JSON

    res.json({ celluleCentrale: false, achevementCL: null })
}
        }
catch (err) {
    logs('/api/bilancertifpartie3', err)
    res.status(500).end()
}
    })








// Web Service permettant d’identifier si une personne fait partie de la cellule déploiement pour lui proposer la possibilité de générer un bilan en tant que Cellule Locale
app.post('/api/bilancertifPartie4', async(req, res) => {
    try {

        const body1 = res.locals.userInfo.sub
        // const body1 = req.body.uid

        const liste1 = []
        //liste 2 correspond aux libellés des équipes
        const liste3 = []
        //liste 4 liste recensant les droits d’une CL Gest
        let i = 0

        const ret3 = (await pool.query(sql_reqs['v3listeCL'])).rows
        for (i; i < ret3.length; i++) {
            liste1[i] = ret3[i].code_unique;
        }
        liste1[ret3.length] = "ITG_MyAccess_Administrateur central";

        const codeUniqueDesCLAuquelIlAppartient = (await pool.query(sql_reqs['v3_si_cl_ou_non'], [body1, liste1])).rows

        //IMPORTANT : POUR CHANGER DE CL ON DECOMENTE LA LIGNE SUIVANTE (en plaçant un code unique (équipe) de son choix) ET ON COMMENTE LA BOUCLE FOR let k = 0
        //liste3[0]="E-0000000180"

        for (let k = 0; k < codeUniqueDesCLAuquelIlAppartient.length; k++) {
            liste3[k] = codeUniqueDesCLAuquelIlAppartient[k].code_unique;
        }

        if(liste3.includes("ITG_MyAccess_Administrateur central")) {
            liste3[0] = "ITG_MyAccess_Administrateur central"
        }

        const bodyDate = req.body.ann;
        const bodyCampagne = req.body.campagne;

        if (liste3[0] === "ITG_MyAccess_Administrateur central") {
            const AllCelluleLocaleJson = (await pool.query(sql_reqs['get_AllCelluleLocale'])).rows
            const habACertifie = []
            const droitCL = []
            for(let jpm = 0; jpm < AllCelluleLocaleJson.length; jpm++) {
                droitCL[jpm] = []
                const droitCLJson = (await pool.query(sql_reqs['v3listeDroitsDeLacLGestionnaire2'], [jpm.libelle])).rows

                for (let jpn = 0; jpn < droitCLJson.length; jpn++) {
                    droitCL[jpn] = droitCLJson[jpn].code_unique
                }
                    const codeUniquePresentDansLaCampagneJson = (await pool.query(sql_reqs["codeUniquePresentDansLaCampagne"], [bodyDate, bodyCampagne, droitCL[jpn]])).rows
                    if (codeUniquePresentDansLaCampagneJson[0].count != 0) {
                        habACertifie[habACertifie.length] = jpm.libelle
                    }
                }
                res.json({ celluleCentrale: true, listeCL: habACertifie });
            } else {
                // AJOUTER UN ELEMENT DANS UN JSON
                res.json({ celluleCentrale: false, listeCL: null });
            }
            } catch (err) {
                logs('/api/bilancertifPartie4', err)
                res.status(500).end()
            }
        })
        
        app.post('/api/statisticsCertification', async(req, res) => {
            try {
                const body1 = res.locals.userInfo.sub
        
                const liste1 = []
                //liste 2 correspond aux libellés des équipes
                const liste3 = []
                let i = 0
        
                const ret3 = (await pool.query(sql_reqs['v3listeCL'])).rows
                for (i; i < ret3.length; i++) {
                    liste1[i] = ret3[i].code_unique;
                }
                liste1[ret3.length] = "ITG_MyAccess_Administrateur central";
        
                const codeUniqueDesCLAuquelIlAppartient = (await pool.query(sql_reqs['v3_si_cl_ou_non'], [body1, liste1])).rows
        
                //IMPORTANT : POUR CHANGER DE CL ON DECOMENTE LA LIGNE SUIVANTE (en plaçant un code unique (équipe) de son choix) ET ON COMMENTE LA BOUCLE FOR let k = 0
                //liste3[0]="E-0000000180"
                for (let k = 0; k < codeUniqueDesCLAuquelIlAppartient.length; k++) {
                    liste3[k] = codeUniqueDesCLAuquelIlAppartient[k].code_unique;
                }
            
                if(liste3.includes("ITG_MyAccess_Administrateur central")) {
                    liste3[0] = "ITG_MyAccess_Administrateur central"
                }
            
                const recuperelaCLDeLaPersonne = (await pool.query(sql_reqs['CLDeLaPersonne'], [liste3[0]])).rows
                let poleDeLaPersonne = '';
                if(recuperelaCLDeLaPersonne[0])
                    poleDeLaPersonne = recuperelaCLDeLaPersonne[0].libelle.value;
            
                const bodyCampagne = req.body.campagne;
                const bodyCL = req.body.cl;
            
                if (liste3[0] === "ITG_MyAccess_Administrateur central") {
                    poleDeLaPersonne = 'ITG_MyAccess_Administrateur central';
                }
            
                if (bodyCL != null) {
                    poleDeLaPersonne = bodyCL
                }
            
                const statistics = (await pool.query(sql_reqs['get_statistics_by_pole'], [bodyCampagne, poleDeLaPersonne])).rows;
            
                res.json({ statistics });
            
            } catch (err) {
                logs('/api/statisticsCertification', err)
                res.status(500).end()
            }
        })
        
        





            function getData(req) {
                let reqBody = {};
                if(req.body.uc_du_beneficiaire != null) {
                    reqBody.uc_du_beneficiaire = req.body.uc_du_beneficiaire
                }
                if(req.body.beneficiaire != null) {
                    reqBody.beneficiaire = req.body.beneficiaire
                }
                if (req.body.pole_du_beneficiaire != null) {
                    reqBody.pole_du_beneficiaire = req.body.pole_du_beneficiaire
                }
                if (req.body.metier_du_beneficiaire != null) {
                    reqBody.metier_du_beneficiaire = req.body.metier_du_beneficiaire
                }
                if (req.body.typologie_de_l_habilitation_revue != null) {
                    reqBody.typologie_de_l_habilitation_revue = req.body.typologie_de_l_habilitation_revue
                }
                if (req.body.libelle_de_l_asset != null) {
                    reqBody.libelle_de_l_asset = req.body.libelle_de_l_asset
                }
                if (req.body.code_unique_role != null) {
                    reqBody.code_unique_role = req.body.code_unique_role
                }
                if (req.body.libelle_du_role != null) {
                    reqBody.libelle_du_role = req.body.libelle_du_role
                }
                if (req.body.description_du_role != null) {
                    reqBody.description_du_role = req.body.description_du_role
                }
                if (req.body.nom_de_la_campagne_de_certification != null) {
                    reqBody.nom_de_la_campagne_de_certification = req.body.nom_de_la_campagne_de_certification
                }
                if (req.body.statut_de_la_certification != null) {
                    reqBody.statut_de_la_certification = req.body.statut_de_la_certification
                }
                if (req.body.destinataire_de_la_certification != null) {
                    reqBody.destinataire_de_la_certification = req.body.destinataire_de_la_certification
                }
                if (req.body.recertificateur != null) {
                    reqBody.recertificateur = req.body.recertificateur
                }
                if (req.body.decision != null) {
                    reqBody.decision = req.body.decision
                }
                if (req.body.date_de_la_decision != null) {
                    reqBody.date_de_la_decision = req.body.date_de_la_decision
                }
                if (req.body.commentaires_du_recertificateur != null) {
                    reqBody.commentaires_du_recertificateur = req.body.commentaires_du_recertificateur
                }
                if (req.body.reassigne_par != null) {
                    reqBody.reassigne_par = req.body.reassigne_par
                }
                if (req.body.reassigne_le != null) {
                    reqBody.reassigne_le = req.body.reassigne_le
                }
                if (req.body.dernier_transfert_le != null) {
                    reqBody.dernier_transfert_le = req.body.dernier_transfert_le
                }
                if (req.body.dernier_transfert_par != null) {
                    reqBody.dernier_transfert_par = req.body.dernier_transfert_par
                }
                if (req.body.date_de_creation != null) {
                    reqBody.date_de_creation = req.body.date_de_creation
                }
                if (req.body.date_de_creation_annee != null) {
                    reqBody.date_de_creation_annee = req.body.date_de_creation_annee
                }
                return reqBody;
            }
            
            function getData2(req) {
                let reqBody = {};
                if (req.body.uid != null) {
                    reqBody.uid = req.body.uid
                }
                if (req.body.statut != null) {
                    reqBody.statut = req.body.statut
                }
                if (req.body.manque_basehabi != null) {
                    reqBody.manque_basehabi = req.body.manque_basehabi
                }
                if (req.body.manque_myaccess != null) {
                    reqBody.manque_myaccess = req.body.manque_myaccess
                }
                if (req.body.date_trait != null) {
                    reqBody.date_trait = req.body.date_trait
                }
                return reqBody;
            }
            /* ---------  PARTIE CERTIFICATION FIN  --------- */            
            
            // INTERNAL FUNCTION : avoir les 13 derniers mois glissants
function getCurrentRollingMonths(pad = true) {
    const rollingMonths = []
    let month = new Date().getMonth() + 1
    let year = new Date().getFullYear()
    for (let i = 0; i < 13; i++) {
        if (pad) {
            rollingMonths.unshift(year + '-' + String(month).padStart(2, '0'))
        } else {
            rollingMonths.unshift(year + '-' + month)
        }
        month--
        if (month < 1) {
            month = 12
            year--
        }
    }
    return rollingMonths
}

// get user info by the access_token
async function getUserInfo(access_token) {
    try {
        const userInfo = await axios(sm.siteiminderLink + 'userinfo?access_token=' + access_token, { httpsAgent })
        return { status: 200, data: userInfo.data }
    } catch (e) {
        logs('getUserInfo: ', e)
        return { status: 500, data: 'Erreur SSO' }
    }
}

// check if the user is in SEC09
async function isSEC09(matricule) {
    const uoSec09 = '13326913'
    try {
        const uo = (await pool.query(sql_reqs["select_uo_of_a_user"], [matricule])).rows[0]
        return uo.uo == uoSec09
    } catch (e) {
        logs('isSEC09', e)
        return false
    }
}


// my_cellules_locales_poles_list
async function get_my_cellules_locales_poles_list(eid) {
    try {
        const res = (await pool.query(sql_reqs['my_cellules_locales_poles_list'], [eid])).rows
        if (res.length == 0) {
            return []
        } else {
            return res[0].poles
        }
    } catch (e) {
        logs('get_my_cellules_locales_poles_list', e)
        return []
    }
}

// internal function get user possible requests options et extraction des droits
async function getRequestsOptions(eid) {
    try {
        const habi = (await pool.query(sql_reqs['user_habi'], [eid])).rows.map(e => e.code_unique)
        let name1 = (await pool.query(sql_reqs['name1'], [eid])).rows.map(e => e.display_name)
        name1 = name1[0]
        const options = {
            proprietaire: (await pool.query(sql_reqs['proprio_check'], [habi])),
            valideur: (await pool.query(sql_reqs['valideur_check'], [habi, name1])),
            secu: (await pool.query(sql_reqs['secu_check'], [habi])),
            limp: (await pool.query(sql_reqs['limp_check'], [habi])),
            manager: (await pool.query(sql_reqs['manager_check'], [eid])),
            cellule_locales: (await pool.query(sql_reqs['cellule_locale_check'], [habi])),
            cellule_centrale: (await pool.query(sql_reqs['cellule_centrale_check'], [eid])),
            csirt: (await pool.query(sql_reqs['csirt_check'], [eid]))
        }

        Object.keys(options).forEach(function(key) {
            try {
                options[key] = options[key].rows[0].res != '0'
            } catch (err) {
                options[key] = false
            }
        })

        return { status: 200, options: options }
    } catch (err) {
        logs('getRequestsOptions', err)
        return { status: 500, options: {} }
    }
}
async function getRequestsOptions2(eid) {
    try {
        const habi = (await pool.query(sql_reqs['user_habi'], [eid])).rows.map(e => e.code_unique)
        let name1 = (await pool.query(sql_reqs['name1'], [eid])).rows.map(e => e.display_name)
        name1 = name1[0]
        const options = {
            proprietaire: (await pool.query(sql_reqs['proprio_check'], [habi])),
            //valideur: (await pool.query(sql_reqs['valideur_check'], [habi, name1])),
            secu: (await pool.query(sql_reqs['secu_check'], [habi])),
            //limp: (await pool.query(sql_reqs['limp_check'], [habi]), 'UnknownUnknownUnknownUnknownUnknown'),
            manager: (await pool.query(sql_reqs['manager_check'], [eid])),
            cellule_locale: (await pool.query(sql_reqs['cellule_locale_check'], [habi])),
            cellule_centrale: (await pool.query(sql_reqs['cellule_centrale_check'], [eid])),
            csirt: (await pool.query(sql_reqs['csirt_check'], [eid]))
        }

        Object.keys(options).forEach(function(key) {
            try {
                options[key] = options[key].rows[0].res != '0'
            } catch (err) {
                options[key] = false
            }
        })

        return { status: 200, options: options }
    } catch (err) {
        logs('getRequestsOptions', err)
        return { status: 500, options: {} }
    }
}

async function getRequestsOptions3(eid) {
    try {
        const habi = (await pool.query(sql_reqs['user_habi1'], [eid])).rows.map(e => e.code_unique)
        let name1 = (await pool.query(sql_reqs['name1'], [eid])).rows.map(e => e.display_name)
        name1 = name1[0]
        const options = {
            limp: (await pool.query(sql_reqs['limp_check'], [habi])),
            cellule_locale: (await pool.query(sql_reqs['cellule_locale_check'], [habi])),
            cellule_centrale: (await pool.query(sql_reqs['cellule_centrale_check'], [eid]))
        }

        Object.keys(options).forEach(function(key) {
            try {
                options[key] = options[key].rows[0].res != '0'
            } catch (err) {
                options[key] = false
            }
        })
        return { status: 200, options: options }
            } catch (err) {
                logs('getRequestsOptions', err)
                return { status: 500, options: {} }
            }
        }
        async function getRequestsOptions4(eid) {
            try {
                const options = {
                    cellule_centrale: (await pool.query(sql_reqs['cellule_centrale_check'], [eid]))
                }
                Object.keys(options).forEach(function(key) {
                    try {
                        options[key] = options[key].rows[0].res != '0'
                    } catch (err) {
                        options[key] = false
                    }
                })
                return { status: 200, options: options }
            } catch (err) {
                logs('getRequestsOptions', err)
                return { status: 500, options: {} }
            }
        }
        
        // should show requests page or not
        async function shouldShowRequestsPage(eid) {
            let should = false
            const ret = await getRequestsOptions(eid)
            Object.keys(ret.options).forEach(e => {
                if (ret.options[e] === true) {
                    should = true
                }
            })
            return should
        }
        
        // should show habilitations page or not
        async function shouldShowhabilitationsPage(eid) {
            let should = false
            const ret = await getRequestsOptions(eid)
            Object.keys(ret.options).forEach(e => {
                if (e != 'valideur' && e != 'imp' && ret.options[e] === true) {
                    should = true
                }
            })
            return should
        }
        // should show rights extraction page or not
async function shouldShowRightsExtractionPage(eid) {
    let should = false
    const ret = await getRequestsOptions(eid)
    Object.keys(ret.options).forEach(e => {
        if (e != 'secu' && e != 'manager' && ret.options[e] === true) {
            should = true
        }
    })
    return should
}

// should show rights extraction page or not
async function shouldShowAssetsPage(eid) {
    let should = false
    const ret = await assetsOptions(eid)
    Object.keys(ret).forEach(e => {
        if (ret[e] === true) {
            should = true
        }
    })
    return should
}

// default 404
app.use(function(_req, res) {
    res.status(404).end()
})

module.exports = app;
