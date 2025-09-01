"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Camera, X, Plus, GripVertical } from "lucide-react"

interface PhotoManagerModalProps {
  open: boolean
  onClose: () => void
  photos: string[]
  onSave: (photos: string[]) => void
}

export function PhotoManagerModal({ open, onClose, photos, onSave }: PhotoManagerModalProps) {
  const [currentPhotos, setCurrentPhotos] = useState<string[]>([])

  useEffect(() => {
    if (open) {
      setCurrentPhotos([...photos])
    }
  }, [open, photos])

  const addPhoto = () => {
    if (currentPhotos.length < 6) {
      const newPhotos = [
        ...currentPhotos,
        `/placeholder.svg?height=400&width=300&query=profile photo ${currentPhotos.length + 1}`,
      ]
      setCurrentPhotos(newPhotos)
    }
  }

  const removePhoto = (index: number) => {
    const newPhotos = currentPhotos.filter((_, i) => i !== index)
    setCurrentPhotos(newPhotos)
  }

  const movePhoto = (fromIndex: number, toIndex: number) => {
    const newPhotos = [...currentPhotos]
    const [movedPhoto] = newPhotos.splice(fromIndex, 1)
    newPhotos.splice(toIndex, 0, movedPhoto)
    setCurrentPhotos(newPhotos)
  }

  const handleSave = () => {
    onSave(currentPhotos)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage Photos</DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <p className="text-sm text-muted-foreground mb-4">
            Add up to 6 photos. Drag to reorder. Your first photo will be your main profile picture.
          </p>

          <div className="grid grid-cols-2 gap-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="aspect-[3/4] relative">
                {currentPhotos[index] ? (
                  <div className="relative w-full h-full group">
                    <img
                      src={currentPhotos[index] || "/placeholder.svg"}
                      alt={`Photo ${index + 1}`}
                      className="w-full h-full object-cover rounded-xl"
                    />

                    {/* Photo Controls */}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-xl flex items-center justify-center">
                      <div className="flex gap-2">
                        {index > 0 && (
                          <Button
                            variant="secondary"
                            size="icon"
                            className="w-8 h-8 rounded-full"
                            onClick={() => movePhoto(index, index - 1)}
                          >
                            <GripVertical className="w-4 h-4" />
                          </Button>
                        )}
                        <Button
                          variant="destructive"
                          size="icon"
                          className="w-8 h-8 rounded-full"
                          onClick={() => removePhoto(index)}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>

                    {/* Main Photo Indicator */}
                    {index === 0 && (
                      <div className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                        Main
                      </div>
                    )}
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    className="w-full h-full rounded-xl border-2 border-dashed border-muted-foreground/30 bg-muted/20 hover:bg-muted/40"
                    onClick={addPhoto}
                    disabled={index > 0 && !currentPhotos[index - 1]}
                  >
                    <div className="flex flex-col items-center gap-2">
                      {index === 0 ? (
                        <>
                          <Camera className="w-8 h-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Add main photo</span>
                        </>
                      ) : (
                        <>
                          <Plus className="w-8 h-8 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground">Add photo</span>
                        </>
                      )}
                    </div>
                  </Button>
                )}
              </div>
            ))}
          </div>

          <p className="text-sm text-muted-foreground text-center mt-4">{currentPhotos.length}/6 photos</p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>Save Photos</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
