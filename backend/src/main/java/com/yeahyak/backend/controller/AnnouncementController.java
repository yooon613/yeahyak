package com.yeahyak.backend.controller;

import com.yeahyak.backend.dto.AnnouncementRequestDTO;
import com.yeahyak.backend.entity.Announcement;
import com.yeahyak.backend.service.AnnouncementService;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;
import org.springframework.data.domain.Page;
import com.yeahyak.backend.dto.ApiResponse;
import com.yeahyak.backend.entity.enums.AnnouncementType;
import com.yeahyak.backend.dto.AnnouncementListResponseDTO;


import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/announcements")
@RequiredArgsConstructor
public class AnnouncementController {

    private final AnnouncementService announcementService;

    @PostMapping
    public ApiResponse<Announcement> create(@RequestBody AnnouncementRequestDTO dto) {
        try {
            Announcement announcement = Announcement.builder()
                    .type(dto.getType())
                    .title(dto.getTitle())
                    .content(dto.getContent())
                    .attachmentUrl(dto.getAttachmentUrl())
                    .createdAt(LocalDateTime.now())
                    .build();

            Announcement saved = announcementService.save(announcement);

            System.out.println(" 저장된 공지사항 ID: " + saved.getAnnouncementId());
            System.out.println(" 저장된 공지: " + saved);

            return new ApiResponse<>(true, saved);

        } catch (Exception e) {
            e.printStackTrace();
            return new ApiResponse<>(false, null, "등록 중 오류: " + e.getMessage());
        }
    }


    @GetMapping
    public ApiResponse<AnnouncementListResponseDTO> getAll(
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size,
            @RequestParam(required = false) String type) {

        Page<Announcement> pagedResult = announcementService.findAllPaged(page, size, type);
        AnnouncementListResponseDTO result = new AnnouncementListResponseDTO(
            pagedResult.getContent(), pagedResult.getTotalElements()
        );
        
        return new ApiResponse<AnnouncementListResponseDTO>(true, result);
    }


    @GetMapping("/{id}")
    public ApiResponse<Announcement> getOne(@PathVariable Long id) {
        return new ApiResponse<>(true, announcementService.findById(id));
    }

    @PutMapping("/{id}")
    public ApiResponse<Announcement> update(@PathVariable Long id, @RequestBody AnnouncementRequestDTO dto) {
        Announcement announcement = Announcement.builder()
                .announcementId(id)
                .type(dto.getType())
                .title(dto.getTitle())
                .content(dto.getContent())
                .updatedAt(LocalDateTime.now())
                .build();

        return new ApiResponse<>(true, announcementService.update(id, announcement));
    }

    @PatchMapping("/{id}")
    public ApiResponse<Announcement> patch(@PathVariable Long id, @RequestBody Map<String, Object> fields) {
        Announcement announcement = announcementService.findById(id);
        if (fields.containsKey("title")) {
            announcement.setTitle((String) fields.get("title"));
        }
        if (fields.containsKey("content")) {
            announcement.setContent((String) fields.get("content"));
        }
        if (fields.containsKey("type")) {
            announcement.setType(AnnouncementType.valueOf((String) fields.get("type")));
        }
        if (fields.containsKey("attachmentUrl")) {
            announcement.setAttachmentUrl((String) fields.get("attachmentUrl"));
        }
        announcement.setUpdatedAt(LocalDateTime.now());

        return new ApiResponse<>(true, announcementService.save(announcement));
    }

    @DeleteMapping("/{id}")
    public ApiResponse<String> delete(@PathVariable Long id) {
        announcementService.delete(id);
        return new ApiResponse<>(true, "삭제되었습니다.");
    }
}