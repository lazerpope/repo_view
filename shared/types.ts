export const ImportTypes = ['lib-external', 'lib', 'lib-builtin', 'file'] as const
export type ImportType = (typeof ImportTypes)[number]
export type Structure = Array<Folder | File>

export interface Folder {
    type: 'folder'
    label: string
    contains: Array<Folder | File>
}
export interface File {
    type: 'file'
    label: string
    imports: Import[]
}

export interface Import {
    type: ImportType
    label: string

}
