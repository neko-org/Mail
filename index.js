module.exports = function mail(mod) {
    let contract = -1
    let parcels = []
    let objParcels = {}
    let working = false
    let deleteAfter = false

    mod.command.add(['mail', 'parcel'], {
        claim: () => {
            checkMail()
        },
        readdel: () => {
            deleteAfter = !deleteAfter
            mod.command.message(`Deleting parcels after reading them: ${deleteAfter ? 'enabled' : 'disabled'}`)
        }
    })

    mod.hook('S_REQUEST_CONTRACT', 1, (event) => {
        contract = event.id
    })
    mod.hook('S_ACCEPT_CONTRACT', 'raw', (event) => {
        contract = -1
        parcels = []
    })
    mod.hook('S_REJECT_CONTRACT', 'raw', (event) => {
        contract = -1
        parcels = []
    })
    mod.hook('S_CANCEL_CONTRACT', 'raw', (event) => {
        contract = -1
        parcels = []
    })

    mod.hook('S_LIST_PARCEL_EX', 2, (event) => {
        for (let message of event.messages) {

            if (message.items.length > 0) {
                let attached = []

                for (let item of message.items) {
                    attached.push(item.id)
                }
                parcels.push({
                    id: message.id,
                    status: message.status,
                    sender: message.sender,
                    items: attached
                })
                objParcels[message.id] = {
                    id: message.id,
                    status: message.status
                }
            } else {
                parcels.push({
                    id: message.id,
                    status: message.status,
                    sender: message.sender,
                    items: []
                })
            }
        }

        if (event.currentPage < event.totalPages - 1) {
            checkMail(event.currentPage + 1)
        }
        else {
            HandleParcels()
        }
    })

    function checkMail(pageIndex) {
        working = true
        mod.send('C_LIST_PARCEL', 2, {
            unk1: 0,
            page: pageIndex,
            filter: 0
        })
    }

    async function HandleParcels() {

        let delet = []
        if (contract !== -1) {
            mod.send('C_CANCEL_CONTRACT', 1, { type: 8, id: contract })
            await new Promise(res => mod.hookOnce('S_CANCEL_CONTRACT', 'raw', res))
            await new Promise(res => setTimeout(res, 200))
        }

        mod.send('C_REQUEST_CONTRACT', 1, { type: 8 })

        await new Promise(res => mod.hookOnce('S_REPLY_REQUEST_CONTRACT', 'raw', res))

        for (let parcel of parcels) {
            if (parcel.status === 2 || parcel.status === 0 && parcel.items.length === 0) {
                delet.push({ id: parcel.id })
            }
            else if (parcel.items.length > 0) {
                mod.send('C_SHOW_PARCEL_MESSAGE', 1, { id: parcel.id })

                await new Promise(res => mod.hookOnce('S_PARCEL_READ_RECV_STATUS', 'raw', res))

                mod.send('C_RECV_PARCEL', 1, { id: parcel.id })

                await new Promise(res => mod.hookOnce('S_RECV_PARCEL', 'raw', res))
            }
        }

        if (deleteAfter) {
            if (delet.length > 0) {
                while (delet.length > 0) {
                    if (delet.length >= 10) {
                        let delet_this = delet.splice(0, 10)

                        mod.send('C_DELETE_PARCEL', 2, {
                            id: contract,
                            messages: delet_this
                        })
                    }
                    else if (delet.length > 0 && delet.length < 10) {
                        let delet_this = delet.splice(0, delet.length)

                        mod.send('C_DELETE_PARCEL', 2, {
                            id: contract,
                            messages: delet_this
                        })
                    }
                    await new Promise(res => mod.hookOnce('S_DELETE_PARCEL', 'raw', res))
                    await new Promise(res => setTimeout(res, 100))
                }
            }
        }
        if (contract !== -1) {
            mod.send('C_CANCEL_CONTRACT', 1, { type: 8, id: contract })
            await new Promise(res => mod.hookOnce('S_CANCEL_CONTRACT', 'raw', res))
            await new Promise(res => setTimeout(res, 200))
        }
        working = false
    }
}